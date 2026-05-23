## Как Выставить Локальный Сервис Наружу Для 1С

Cloudflare Tunnel:

```bash
cloudflared tunnel --url http://localhost:3006
```

ngrok:

```bash
ngrok http 3006
```