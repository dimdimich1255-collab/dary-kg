"""Модерация отзывов: защита от спама, лимиты, пароль администратора.

Настройки берутся из переменных окружения (на Render их вписывают в Environment):
  ADMIN_PASSWORD      пароль админки. Если не задан, админка отключена
  IP_SALT             любая длинная случайная строка: «соль» для хеширования IP-адресов
  TRUST_PROXY=1       сайт стоит за nginx или Render: настоящий IP берём из X-Forwarded-For
  REVIEW_LIMIT_10MIN  сколько отзывов с одного IP за 10 минут (по умолчанию 3)
  REVIEW_LIMIT_DAY    сколько отзывов с одного IP за сутки (по умолчанию 10)
  REPORTS_TO_HIDE     сколько жалоб скрывают отзыв до проверки (по умолчанию 3)
"""

import base64
import binascii
import hashlib
import hmac
import os
import re
import time

from fastapi import Header, HTTPException, Request

ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
IP_SALT = os.getenv("IP_SALT", "dev-only-salt-change-me")
TRUST_PROXY = os.getenv("TRUST_PROXY") == "1"
LIMIT_10MIN = int(os.getenv("REVIEW_LIMIT_10MIN", "3"))
LIMIT_DAY = int(os.getenv("REVIEW_LIMIT_DAY", "10"))
REPORTS_TO_HIDE = int(os.getenv("REPORTS_TO_HIDE", "3"))

# Спам почти всегда содержит ссылку: адрес с http(s)://, www., t.me/ или домен вроде shop.ru
LINK_RE = re.compile(r"(https?://|www\.|t\.me/|\b[\w-]+\.(com|ru|kg|net|org|info|me|io)\b)", re.IGNORECASE)


def has_link(*texts: str) -> bool:
    return any(LINK_RE.search(t) for t in texts)


def client_ip(request: Request) -> str:
    """IP посетителя. За прокси (nginx, Render) последний адрес в X-Forwarded-For добавляет сам прокси,
    ему можно верить; первые адреса посетитель может подделать."""
    if TRUST_PROXY:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


def ip_hash(request: Request) -> str:
    """IP в виде хеша: для лимитов его хватает, а узнать по нему человека нельзя."""
    return hashlib.sha256(f"{IP_SALT}:{client_ip(request)}".encode()).hexdigest()


# Неудачные попытки входа в админку: хеш IP -> время попыток (в памяти процесса)
_failed_logins: dict[str, list[float]] = {}


def require_admin(request: Request, authorization: str = Header(default="")):
    """Пускает в админку только с верным паролем: «Authorization: Bearer <пароль в base64>»."""
    if not ADMIN_PASSWORD:
        raise HTTPException(404, "Not Found")  # админка отключена, будто её нет

    who = ip_hash(request)
    now = time.time()
    recent = [t for t in _failed_logins.get(who, []) if now - t < 600]
    if len(recent) >= 5:
        raise HTTPException(429, "Слишком много неверных попыток. Подождите 10 минут.")

    # Пароль приходит в base64 (UTF-8): иначе русские буквы нельзя передать в HTTP-заголовке
    try:
        given = base64.b64decode(authorization.removeprefix("Bearer ").strip(), validate=True)
    except (binascii.Error, ValueError):
        given = b""
    if not hmac.compare_digest(given, ADMIN_PASSWORD.encode()):
        _failed_logins[who] = recent + [now]
        raise HTTPException(401, "Неверный пароль")
    _failed_logins.pop(who, None)
