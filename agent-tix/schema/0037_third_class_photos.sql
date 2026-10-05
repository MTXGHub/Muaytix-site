-- Third Class: four photos, in Jason's order. Loaded ahead of the header that
-- shows them; a guest sees no change until that header is pasted.
--
-- The 360 degree view, the front rows, the seat map graphic, and the seating.
-- A class only shows its photos while it can be bought, and Third Class opens on
-- selected nights, so it only appears as a photo card on a night it is open.

update ticket_classes set photos = '[
  {"url": "https://static.tildacdn.com/tild3130-3462-4461-b666-313734323561/1000035312.jpg",
   "alt": "360 degree view from Third Class"},
  {"url": "https://static.tildacdn.com/tild6132-3930-4232-a265-663463393032/1000035313.jpg",
   "alt": "Front rows of Third Class"},
  {"url": "https://static.tildacdn.com/tild3661-3038-4631-b639-313865636531/1000035315.jpg",
   "alt": "Third Class seat map"},
  {"url": "https://static.tildacdn.com/tild3235-6336-4663-b538-323232356630/1000035314.jpg",
   "alt": "Third Class seating"}
]'::jsonb where code = 'third_class';
