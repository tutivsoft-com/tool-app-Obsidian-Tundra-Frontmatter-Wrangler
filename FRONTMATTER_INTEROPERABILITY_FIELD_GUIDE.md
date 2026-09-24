# Frontmatter Interoperability Field Guide

This guide documents Tundra's implemented cumulative four-tier set of 50 frontmatter properties. The tiers are Bare Minimum (4), Standard (9), Advanced (21), and Huge (50). Standard is the default, the selected property list can be edited, and `image` is part of every tier.

## Interoperability principles

There is no universal frontmatter schema that every application interprets identically. Obsidian accepts custom properties, and tools such as Dataview can query them, but only recognized properties trigger an application's built-in behavior. Keep one canonical key per concept in notes; use export mappings when another application expects a different key.

This proposal avoids synonym pairs and duplicated concepts: use `summary` rather than also storing `description`; `author` rather than `creator`; `source` plus `url` rather than a second source-URL field; and `date` rather than multiple generic created/published/modified date aliases. Obsidian and Dataview already expose file creation and modification timestamps, so those are not duplicated as generated frontmatter by default.

The distinct date fields have distinct roles and are only relevant to certain note types: `date` is the primary date for a note; `start` and `end` describe an event span; `accessed` is when a source was consulted; `due` and `completed` apply to task workflows. Do not populate every date field on every note.

## Tier 1 — Bare Minimum (4 fields)

This includes Tundra's current minimum set plus `image`.

1. `title` — text; readable note title.
2. `summary` — text; concise note summary.
3. `tags` — list; topics and retrieval labels.
4. `image` — link or URL; reference a real image associated with the note. Never invent a path or URL; omit the value when no image is present.

Obsidian Publish recognizes `image` for social previews. [Obsidian Properties](https://obsidian.md/help/properties)

## Tier 2 — Standard (9 fields total)

Keep Bare Minimum and add:

5. `aliases` — list; alternate note names recognized by Obsidian.
6. `type` — controlled text; note kind such as `person`, `project`, `event`, or `source`.
7. `date` — date; the note's primary date, in ISO format.
8. `status` — controlled text; workflow state such as `active` or `archived`.
9. `source` — text or link; the name or reference of the originating source.

`type` is useful with Meridian Timeline, but Hugo reserves that key for its own content type. Use a conversion mapping when publishing directly with Hugo.

## Tier 3 — Advanced (21 fields total)

Keep Standard and add:

10. `author` — person or organization responsible for the source or authored note.
11. `identifier` — text; stable ID such as a DOI, ISBN, or external record ID.
12. `citation` — text; formatted citation.
13. `project` — link or text; associated project.
14. `people` — list; people mentioned or linked.
15. `organization` — text or link; relevant organization.
16. `location` — text or link; relevant place.
17. `start` — date; start of an event or time span.
18. `end` — date; end of an event or time span.
19. `priority` — number or controlled value; importance for a task or project.
20. `language` — text; language code such as `en`.
21. `url` — URL; direct web address for the source or related page.

Meridian Timeline reads `date`, `start`, and `end`. Keep `start` and `end` for span-based notes rather than using them as extra generic dates.

## Tier 4 — Huge (50 fields total)

Keep Advanced and add:

22. `publisher` — text; publishing organization.
23. `contributor` — list; other contributors.
24. `rights` — text; rights statement.
25. `license` — text or URL; license name or link.
26. `format` — controlled text; resource format such as `book`, `audio`, or `webpage`.
27. `relation` — link or list of links; related resource.
28. `audience` — text or list; intended audience.
29. `confidence` — number; confidence score when a process produces one.
30. `reviewed` — checkbox; whether a review has happened.
31. `reviewer` — person or link; reviewer identity.
32. `version` — text; version of the described document or artifact.
33. `publish` — checkbox; Obsidian Publish selection.
34. `cssclasses` — list; Obsidian per-note CSS classes.
35. `permalink` — URL or path; fixed published address.
36. `slug` — text; URL-friendly path segment.
37. `edition` — text or number; edition of a publication.
38. `volume` — text or number; publication volume.
39. `issue` — text or number; publication issue.
40. `page` — text or number; page reference.
41. `chapter` — text or number; chapter reference.
42. `duration` — text; media or event length, such as `45 minutes`.
43. `transcript` — link; location of a transcript.
44. `ocr_status` — controlled text; OCR state such as `needs-review` or `verified`.
45. `page_count` — number; count for a scanned or paginated source.
46. `accessed` — date; when a source was consulted.
47. `method` — text; method used to produce or analyze the resource.
48. `purpose` — text; reason the note or resource exists.
49. `due` — date; task deadline. Task plugins generally expect due dates on task lines, so frontmatter alone may not drive task behavior.
50. `completed` — date; task completion date. Task plugins generally expect completion data on task lines.

## Suggested use

Treat each tier as an allowed set of properties, not a template that fills every property on every note. Tundra asks AI for up to 20 relevant standard tags when `tags` is selected, allows fewer when fewer are useful, normalizes tags to lowercase kebab-case (keeping useful `/` hierarchies), removes duplicates, and omits an empty tag list. AI values remain proposals for review; unsupported values are omitted instead of guessed. Tundra accepts `image` only when the proposed reference already occurs in the note body or existing `image` property.

Possible future presets can narrow the Huge set by note type: **Research source**, **Person**, **Project**, **Event**, **Task**, and **OCR transcript**. Task-specific dates should stay on task lines when the chosen task plugin expects that form. For publishing, map the canonical `summary` to a site's `description` field at export time rather than storing both in each note.

Tundra's current AI flow supports requested top-level properties with simple values or lists; it does not support nested property objects. Existing values should remain protected unless the user explicitly chooses replacement.

## Sources

- [Obsidian Properties](https://obsidian.md/help/properties) — property types, built-in `tags`, `aliases`, and `cssclasses`, plus Obsidian Publish fields such as `publish`, `permalink`, `description`, `image`, and `cover`.
- [Obsidian Aliases](https://obsidian.md/help/aliases) — alias list behavior.
- [Dataview metadata on pages](https://blacksmithgu.github.io/obsidian-dataview/annotation/metadata-pages/) — custom fields and implicit file timestamps.
- [Dublin Core Metadata Terms](https://www.dublincore.org/documents/dcmi-terms/) — cross-domain metadata vocabulary.
- [Hugo front matter](https://gohugo.io/content-management/front-matter/) — reserved fields and date/publishing conventions.
- [Jekyll front matter](https://jekyllrb.com/docs/front-matter/) — common title, date, permalink, categories, and tags conventions.
- [Schema.org Article](https://schema.org/Article) — article metadata such as headline, author, and publication dates.

Companion plugin documentation also informed the set: Meridian Timeline reads dates and event spans, Cairn Vault Linter checks aliases, and Tundra manages the vault's frontmatter. Task metadata behavior is task-line-specific in common task workflows.
