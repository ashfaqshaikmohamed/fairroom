# Connect Factory and Chalk

Open this folder in VS Code: `fairroom-final/current code`. Edit its `.env`, not the parent's `.env.example`. Preserve your Photon and local-iMessage settings. Never commit or share this file.

## Factory
1. Sign in at https://app.factory.ai/ and redeem any HackHarvard credits provided by the sponsor.
2. Open Settings → API keys and create a FairRoom key.
3. Add these lines to `.env`:

```dotenv
FACTORY_API_KEY=replace_with_your_key
FACTORY_ENABLED=true
```

`npm install` installs the SDK and project-local Droid CLI. No global installation is needed. Optional `FACTORY_MODEL` selects an account-supported model; leave it unset to use the account default. Optional `FACTORY_DROID_PATH` overrides the project-local executable.

Restart FairRoom, then open http://localhost:3000/ . Choose Meet FairRoom → preview as Alex (organizer; Maya in legacy fixture mode) → Homes → Before you commit → Get independent review. This button calls Factory; it is not a prerecorded result. It may take up to 90 seconds. The returned review is cached for one hour. The public ngrok page can read completed reviews, but cannot trigger paid reviews. Up to six new review attempts per server process/hour are permitted.

The reviewer reads public saved listing evidence, runs the deterministic fact checks, then submits a summary and broker questions using three bounded tools. Other discovered tools are disabled before the run. No private roommate surveys are passed into the review. This is evidence review, not proof that a property is legitimate or currently available. Live behavior is not verified until the first authenticated run succeeds.

Source: https://docs.factory.com/sdk/typescript

## Chalk
1. Open https://chalk.ai/hackharvard and obtain hackathon access/credits.
2. In the Chalk dashboard open Model Gateway → Routing → Connections. Use a sponsor-provided connection if available; otherwise add your model-provider credentials there.
3. In Playground, choose an available model and send a small test prompt.
4. Create a Model Gateway API key. Copy the environment ID and exact model ID from the request example. A gateway key does not itself provide an upstream model account.
5. Add these lines to `.env`:

```dotenv
AI_PROVIDER=chalk
CHALK_ROUTER_API_KEY=replace_with_gateway_key
CHALK_ENV_ID=replace_with_environment_id
CHALK_MODEL=replace_with_exact_model_identifier
```

After saving, run:

```sh
npm run check:sponsors
npm run eval:chalk
```

The first command only reports presence/absence; it never prints credentials. The second makes ten real model requests through Chalk and writes `data/evals/chalk-latest.json`. A fallback response does not count as a successful gateway evaluation. Inspect failures and do not claim a perfect score unless the result actually shows it. These are local evaluations of live Chalk Gateway responses, not Chalk-hosted Agent Evals.

Restart FairRoom after configuring credentials. A natural request such as “Could you pull together places that suit all three of us?” uses Chalk to classify intent, then the existing matching engine calculates results. Model output never directly changes a budget or calculates money. Explicit preference changes still require confirmation.

Source: https://docs.chalk.ai/docs/model-gateway

## Restart
Stop the existing FairRoom server with Ctrl+C in its terminal. In this project folder run:

```sh
npm run dev
```

A tunnel is only needed for a separately configured live phone flow. Don't start a second FairRoom process against the same database. If Codex is hosting the existing process, tell it the keys are saved so it can restart that process.

## Current verification
- Live iMessage: outside the submission audit; no current delivery verification.
- Factory SDK/CLI: installed; requires local credentials; no live review yet.
- Chalk routing and evaluation runner: implemented; requires local credentials; no live gateway evaluation yet.
- Listing evidence checks, scoped API access and mock gateway routing: tested.
- Daytona: removed from scope and dependencies.
