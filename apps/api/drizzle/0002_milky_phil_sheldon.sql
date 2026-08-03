ALTER TABLE "taggings" ADD COLUMN "tag_label" text NOT NULL;--> statement-breakpoint
ALTER TABLE "taggings" ADD COLUMN "tag_colour" text;--> statement-breakpoint
ALTER TABLE "taggings" ADD COLUMN "tag_scope" text NOT NULL;--> statement-breakpoint
ALTER TABLE "taggings" ADD COLUMN "tag_namespace" text;--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "namespace" text;--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "retired_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "tags_system_namespace_label_uidx" ON "tags" ("namespace","label") WHERE "scope" = 'system';--> statement-breakpoint
-- Curated system tag seed (DESIGN §4 / P2-D). Fixed ids; random hex colours; no icons.
INSERT INTO "tags" ("id","scope","owner_id","namespace","label","colour","icon","retired_at") VALUES
	('a1000000-0000-4000-8000-000000000001','system',NULL,'type','monument','#c45c26',NULL,NULL),
	('a1000000-0000-4000-8000-000000000002','system',NULL,'type','view','#3d8bfd',NULL,NULL),
	('a1000000-0000-4000-8000-000000000003','system',NULL,'type','trail','#5a8f3c',NULL,NULL),
	('a1000000-0000-4000-8000-000000000004','system',NULL,'type','natural_feature','#2f6f4e',NULL,NULL),
	('a1000000-0000-4000-8000-000000000011','system',NULL,'terrain','easy','#7cb342',NULL,NULL),
	('a1000000-0000-4000-8000-000000000012','system',NULL,'terrain','moderate','#f0a202',NULL,NULL),
	('a1000000-0000-4000-8000-000000000013','system',NULL,'terrain','hard','#e85d04',NULL,NULL),
	('a1000000-0000-4000-8000-000000000014','system',NULL,'terrain','impossible','#9b2226',NULL,NULL),
	('a1000000-0000-4000-8000-000000000021','system',NULL,'rurality','urban','#6c757d',NULL,NULL),
	('a1000000-0000-4000-8000-000000000022','system',NULL,'rurality','suburban','#adb5bd',NULL,NULL),
	('a1000000-0000-4000-8000-000000000023','system',NULL,'rurality','rural','#8d6e63',NULL,NULL),
	('a1000000-0000-4000-8000-000000000024','system',NULL,'rurality','remote','#5d4037',NULL,NULL),
	('a1000000-0000-4000-8000-000000000031','system',NULL,'beauty','unrefined','#a1887f',NULL,NULL),
	('a1000000-0000-4000-8000-000000000032','system',NULL,'beauty','plain','#bdbdbd',NULL,NULL),
	('a1000000-0000-4000-8000-000000000033','system',NULL,'beauty','moderate','#90caf9',NULL,NULL),
	('a1000000-0000-4000-8000-000000000034','system',NULL,'beauty','exquisite','#ce93d8',NULL,NULL),
	('a1000000-0000-4000-8000-000000000041','system',NULL,'privacy','bustling','#ef5350',NULL,NULL),
	('a1000000-0000-4000-8000-000000000042','system',NULL,'privacy','populated','#ff7043',NULL,NULL),
	('a1000000-0000-4000-8000-000000000043','system',NULL,'privacy','quiet','#66bb6a',NULL,NULL),
	('a1000000-0000-4000-8000-000000000044','system',NULL,'privacy','secluded','#26a69a',NULL,NULL);
