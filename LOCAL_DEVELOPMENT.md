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
3. Run `yarn dev`
4. Wait 2 billion years poor pages to load initially as cal compiles them on the fly on this mode.

