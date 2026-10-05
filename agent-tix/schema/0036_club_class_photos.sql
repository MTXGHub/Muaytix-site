-- Club Class: five photos, in Jason's order. Loaded ahead of the header that
-- shows them; a guest sees no change until that header is pasted.
--
-- Rear of Section 9 (row I), Section 9 from seat A1, the seat map graphic,
-- Section 8 row K, and the seating itself.

update ticket_classes set photos = '[
  {"url": "https://static.tildacdn.com/tild6232-3838-4334-b339-613764646539/1000035306.jpg",
   "alt": "View from the rear, row I of Section 9"},
  {"url": "https://static.tildacdn.com/tild6533-6461-4365-b736-616164396130/1000035305.jpg",
   "alt": "Section 9 from seat A1 of Club Class"},
  {"url": "https://static.tildacdn.com/tild6434-3337-4231-b764-393130313439/1000035308.jpg",
   "alt": "Club Class seat map"},
  {"url": "https://static.tildacdn.com/tild3762-3339-4832-b664-386439623139/1000035304.jpg",
   "alt": "Section 8 row K, Club Class"},
  {"url": "https://static.tildacdn.com/tild3363-6665-4166-b834-396530316166/1000035307.jpg",
   "alt": "Club Class seating"}
]'::jsonb where code = 'club_class';
