# Local Development

To be able to run the app on your machine, do the following:

1. Create a `.env` file with the right values (ask for it in slack)
2. You can use a database specifically for dev (local) development in Digital Ocean
   you can find it here https://cloud.digitalocean.com/databases/17c20f28-ea8f-40fb-8d10-942be051789f?i=afde57
   get the connection url string and set it in you .env file as (redacted)
   `DATABASE_URL=postgresql://user:password@name.c.db.ondigitalocean.com:25061/local?sslmode=require`
   if you wish to set up using a local database, create one anyway you want (docker is easier) and use the connection
   string for that instead. Keep in mind you will need to migrate it, the easiest way to do it is by
   running `docker-compose build calcom` as migrating the db is part of the image build (for some reason idk).

   - You can also set up the database locally using the Prisma schema (found in `packages/prisma/schema.prisma`):
   
   Copy and paste your `DATABASE_URL` from `.env` to `.env.appStore`.

   In a development environment, run:

   ```sh
   yarn workspace @calcom/prisma db-migrate
   ```

3. Run `yarn dev`
4. Wait 2 billion years poor pages to load initially as cal compiles them on the fly on this mode.
5. Make sure you open http://localhost:3003 not using https as the browser will complain since it is not secure.
6. Sign in with you google account.
6. For integrations with Google calendar you can read the README section titles **Integrations** to not repeat them here.

From the readme just for clarity:

#### _Adding google calendar to Cal.com App Store_

After adding Google credentials, you can now Google Calendar App to the app store.
You can repopulate the App store by running

```
cd packages/prisma
yarn seed-app-store
```

You will need to complete a few more steps to activate Google Calendar App.
Make sure to complete section "Obtaining the Google API Credentials". After that do the
following

1. Add extra redirect URL `<Cal.com URL>/api/auth/callback/google`
1. Under 'OAuth consent screen', click "PUBLISH APP"

