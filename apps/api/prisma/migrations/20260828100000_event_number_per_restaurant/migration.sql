-- Event numbers are counted per restaurant (EventRepository.create derives the
-- next number from that restaurant's own maximum), but the column carried a
-- GLOBAL unique constraint. Once two restaurants' ranges overlapped, the second
-- one to reach a taken number could no longer create any event at all: the
-- insert raised a unique violation, and retrying recomputed the same number.
--
-- Scoping the constraint to the restaurant is strictly weaker than the one it
-- replaces, so no existing row can violate it.
DROP INDEX IF EXISTS "Event_eventNumber_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Event_restaurantId_eventNumber_key"
  ON "Event" ("restaurantId", "eventNumber");
