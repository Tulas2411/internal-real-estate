-- Preserve existing users. Their real phone must be assigned by an administrator;
-- never invent a phone from an email or replace passwords/history.
ALTER TABLE "User" ADD COLUMN "phoneNumber" TEXT;
ALTER TABLE "User" ADD COLUMN "phoneNumberVerified" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User" ("phoneNumber");
ALTER TABLE "User" ADD CONSTRAINT "User_canonical_phone" CHECK (
  "phoneNumber" IS NULL OR (
    "phoneNumber" ~ '^\+[1-9][0-9]{7,14}$'
    AND ("phoneNumber" NOT LIKE '+84%' OR "phoneNumber" ~ '^\+84[35789][0-9]{8}$')
  )
);
