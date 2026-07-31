-- Hosts reuse the performer profile/calendar/booking tables and are told apart
-- by AdminUser.role, so the only schema they need is the event programme.

-- The "What do you do?" free-text field is gone from performer and host
-- profiles alike: the block a person appears in now says what they are.
ALTER TABLE "PerformerProfile" DROP COLUMN "craft";

-- The event programme. Required by the API when the person being booked is a
-- host, and carried onto the calendar entry when the host accepts.
ALTER TABLE "PerformerBooking" ADD COLUMN "program" TEXT;
ALTER TABLE "PerformerEvent" ADD COLUMN "program" TEXT;
