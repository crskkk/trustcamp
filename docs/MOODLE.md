# MOODLE.md — Registering THE BAR as an LTI 1.3 tool

THE BAR pushes each player's session score to the Moodle gradebook when the
host (the instructor who launched it) chooses **Settings → Wrap session and
push grades** in the in-game menu. Nothing is pushed silently (STANDARDS §10.3).

## What you need

- The game server reachable over **HTTPS** (Moodle must call it). Fly.io works
  out of the box (`fly deploy`, see `fly.toml`); any host that runs
  `pnpm server` behind TLS is fine. Call its base URL `https://SERVER`.
- The game client URL, e.g. `https://crskkk.github.io/trustcamp/`.

## 1. Server environment

```bash
LTI_ISSUER=https://your-moodle.example          # Moodle site URL (the "platform ID")
LTI_CLIENT_ID=abc123                            # from Moodle after step 2
LTI_DEPLOYMENT_ID=1                             # from Moodle after step 2
# Defaults derived from LTI_ISSUER (override only if your Moodle differs):
# LTI_AUTH_URL=$LTI_ISSUER/mod/lti/auth.php
# LTI_TOKEN_URL=$LTI_ISSUER/mod/lti/token.php
# LTI_JWKS_URL=$LTI_ISSUER/mod/lti/certs.php
PUBLIC_URL=https://SERVER                       # this server, https
CLIENT_URL=https://crskkk.github.io/trustcamp/  # where players are sent after launch
# WS_URL=wss://SERVER                           # default: PUBLIC_URL with ws scheme
# LTI_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----…" # optional; otherwise a key is generated
                                                # and kept at data/lti-key.pem (keep the volume!)
```

Restart the server. `GET https://SERVER/health` shows `"lti": true`, and
`GET https://SERVER/lti/jwks` returns the tool's public key.

## 2. Moodle: add the tool (site administrator)

*Site administration → Plugins → Activity modules → External tool → Manage tools → configure a tool manually*

| Field | Value |
|---|---|
| Tool name | THE BAR |
| Tool URL | `https://SERVER/lti/launch` |
| LTI version | LTI 1.3 |
| Public key type | Keyset URL |
| Public keyset | `https://SERVER/lti/jwks` |
| Initiate login URL | `https://SERVER/lti/login` |
| Redirection URI(s) | `https://SERVER/lti/launch` |
| Tool configuration usage | Show in activity chooser and as a preconfigured tool |
| Default launch container | New window |
| **Services → IMS LTI Assignment and Grade Services** | Use this service for grade sync only |
| Services → IMS LTI Names and Role Provisioning | Do not use this service (not needed) |
| **Privacy → Share launcher's name with tool** | Never |
| **Privacy → Share launcher's email with tool** | Never |
| Privacy → Accept grades from the tool | Always |

Save, then open the tool's *details* (the list icon) and copy **Client ID** and
**Deployment ID** into the server environment (step 1).

## 3. Course: add the activity

In a course: *Add an activity → External tool → THE BAR*. Set **Grade → Type:
Point, Maximum grade: 100** so Moodle creates a gradebook line item (the
server refuses to wrap a session that has no line item). Save.

## 4. Play and wrap (human test T-9)

1. As the instructor, open the activity. Moodle performs the OIDC login →
   launch; you land in the game with the menu's Settings tab showing
   *Connection: Online (server)* and a **Wrap session and push grades** button
   (instructors and admins only).
2. Students open the same activity: each gets their own camper, joins the same
   session, and plays Camp Games rounds; the leaderboard is live for everyone.
3. Instructor: menu → Settings → **Wrap session and push grades**. The toast
   reports how many scores were pushed. In Moodle, *Grades* shows each
   student's points for the activity (scoreGiven = total points of their
   rounds in this session, scoreMaximum = total possible).

Only the opaque LTI `sub` is sent back to Moodle (AGS requires it); names and
emails are never requested, read, or stored (`server/lti.ts`).

## Troubleshooting

- `unknown issuer` on login: `LTI_ISSUER` must equal Moodle's site URL exactly (no trailing slash).
- `unknown deployment`: `LTI_DEPLOYMENT_ID` differs from the tool details in Moodle.
- `session has no gradebook line item`: the activity was added without grading; edit it and set a maximum grade.
- Wrap returns `not a host`: only launches with Instructor/Administrator roles may push.
- Mixed content / blank page after launch: `PUBLIC_URL` and `CLIENT_URL` must both be https.
