# 1C CommerceML Exchange Service

Локальный HTTP-сервис для приема CommerceML-обмена из 1С. Сервис поднимает endpoint `/exchange`, проверяет Basic Auth, принимает файлы выгрузки и сохраняет их в локальную директорию.

## Требования

- Node.js `22` или новее.
- npm.
- Для публичного временного URL: `cloudflared`. В проекте есть npm-зависимость `cloudflared`, поэтому при запуске через npm-скрипты обычно достаточно `npm install`.

## Быстрый Старт

```bash
npm install
cp .env.example .env
```

Откройте `.env` и задайте логин/пароль, которые будет использовать 1С:

```env
COMMERCE_LOGIN=login
COMMERCE_PASSWORD=password
```

Запуск локально:

```bash
npm start
```

По умолчанию сервис слушает:

```text
http://localhost:3010
```

Проверка:

```bash
curl http://localhost:3010/health
```

## Ручной Запуск Cloudflare Tunnel

Туннель поднимается отдельно после запуска сервера.

В первом терминале запустите сервис:

```bash
npm start
```

Во втором терминале запустите Cloudflare Tunnel на тот же порт:

```bash
cloudflared tunnel --url http://localhost:3010
```

Если `cloudflared` доступен только из npm-зависимости проекта, используйте:

```bash
npx cloudflared tunnel --url http://localhost:3010
```

В выводе `cloudflared` появится URL вида:

```text
https://example-name.trycloudflare.com
```

Для 1С используйте адрес обмена:

```text
https://example-name.trycloudflare.com/exchange
```

Quick Tunnel не требует аккаунта Cloudflare, но URL временный и меняется после перезапуска туннеля.

## Запуск В Режиме Разработки

```bash
npm run dev
```

Туннель для dev-режима поднимается так же отдельно:

```bash
cloudflared tunnel --url http://localhost:3010
```

## Настройки `.env`

| Переменная | По умолчанию | Описание |
| --- | --- | --- |
| `COMMERCE_LOGIN` | нет | Логин для Basic Auth из 1С. Обязательная переменная. |
| `COMMERCE_PASSWORD` | нет | Пароль для Basic Auth из 1С. Обязательная переменная. |
| `PORT` | `3010` | Локальный порт сервера. |
| `UPLOAD_DIR` | `uploads` | Директория для принятых файлов CommerceML. |
| `SESSION_COOKIE_NAME` | `commerce_ml_session` | Имя cookie сессии после `mode=checkauth`. |
| `LOG_DIR` | `logs` | Директория для логов. |
| `COMMERCE_FILE_LIMIT_BYTES` | `8192` | Значение `file_limit`, которое сервис возвращает 1С на `mode=init`. |

## Endpoints

### `GET /health`

Возвращает JSON со статусом сервиса и путями до директорий загрузок/логов.

### `/exchange`

Endpoint для CommerceML-обмена с 1С. Поддерживаемые режимы:

| Query | Назначение |
| --- | --- |
| `mode=checkauth` | Проверяет Basic Auth и возвращает cookie сессии. |
| `mode=init` | Возвращает `zip=no` и `file_limit`. |
| `mode=file&filename=...` | Принимает тело файла и сохраняет его в `UPLOAD_DIR`. |
| `mode=import&filename=...` | Подтверждает импорт ранее загруженного файла. |

Пример локального URL для 1С:

```text
http://localhost:3010/exchange
```

Пример публичного URL через Cloudflare Tunnel:

```text
https://example-name.trycloudflare.com/exchange
```

## Файлы И Логи

- Загруженные файлы сохраняются в `UPLOAD_DIR`, по умолчанию `uploads`.
- Логи пишутся в `LOG_DIR/commerce-ml.log`, по умолчанию `logs/commerce-ml.log`.
- В консоль также выводятся ключевые события: старт сервера, авторизация, загрузка файлов, импорт и состояние туннеля.

## Проверка Кода

```bash
npm run check
```

Команда выполняет синтаксическую проверку JavaScript-файлов через `node --check`.
