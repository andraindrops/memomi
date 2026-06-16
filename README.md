# Memomi

## Getting Started

```sh
npm install
npm start
```

## Setup Clerk

```
curl -X PATCH https://api.clerk.com/v1/instance \
  -H "Authorization: Bearer sk_live_<YOUR_SECRET_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"allowed_origins": ["http://localhost:5173"]}'
```

```
- Enable Native API:       enabled
- Sign-up with password:   disabled
- Add password to account: disabled
- Bot sign-up protection:  disabled
```
