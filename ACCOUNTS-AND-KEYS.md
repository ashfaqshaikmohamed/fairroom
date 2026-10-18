# Accounts and keys

The local recorded web demo needs **none**. Live iMessage needs Photon and a reachable HTTPS app.

| Service | Needed for | What to obtain |
| --- | --- | --- |
| Photon 2.0 | Required for the challenge’s live messaging | Beta access, a project, a server-side API key, and a dedicated **group-capable iMessage line** |
| OpenAI API | Optional natural-language interpretation | API key and an available Responses API model supporting strict JSON-schema output; supported commands work without it |
| Hosting or an HTTPS tunnel | Private form links people can open on their phones | A stable HTTPS URL pointing to the running Node app; persistent disk if hosted |
| GitHub | Optional repository/submission | Your existing account is sufficient |

No Twilio, Zillow, Airbnb, Supabase, authentication-service or payment API key is required for this version. Photon is the only messaging provider. Do not assume the Photon beta number is free or that a shared line supports group chats: ask the Photon hackathon team for access and credits.

## Local `.env`

Start with `.env.example`. Set these only when you have Photon access:

```dotenv
PHOTON_API_KEY=your_server_side_project_key
PHOTON_PROJECT_ID=pho_prj_your_project
PHOTON_AGENT_HANDLE=+1YOUR_AGENT_NUMBER
PUBLIC_APP_URL=https://your-public-app.example
PHOTON_ENABLED=true
```

Optional:

```dotenv
OPENAI_API_KEY=your_server_side_key
OPENAI_MODEL=your_available_structured_output_model
SCOUT_SCHEDULER_ENABLED=false
```

Leave the scheduler off for a controlled recording. Turn it on for periodic checks of the saved catalog after testing consent and delivery. It sends at most one automatic digest per 24 hours per group, with duplicate suppression.

Never use a `VITE_` prefix for these keys; that would put them in the browser bundle. Never paste keys into a chat, GitHub, screenshots or Devpost. Restart the server after changing `.env`.

For hosted use, set `NODE_ENV=production`, build first, use `HOST=0.0.0.0`, the host’s `PORT`, and persistent `FAIRROOM_DATA_DIR`. For a tunnel, point it at your local port and keep the machine and server running. A changed URL must also update `PUBLIC_APP_URL`.

## Before the Photon recording

1. Obtain the dedicated line; confirm with Photon that your beta project can participate in an iMessage group.
2. Open the public URL from a phone on cellular data.
3. Put two consenting test participants and the agent in a real group. Send `FairRoom start`.
4. Each participant privately sends the returned `join CODE Name` command to the agent, opens their private form and opts in.
5. Verify a real command reply arrives on both phones. Record that, with the sample data clearly identified if using the sample group.

The web preview must not be presented as a successfully delivered iMessage. Mocked tests demonstrate the code contract; only receipt on the actual phones completes the live check.

Official docs: [Photon beta iMessage](https://photon.codes/docs/beta/get-started/imessage), [Photon project setup](https://photon.codes/docs/beta/get-started/project).
