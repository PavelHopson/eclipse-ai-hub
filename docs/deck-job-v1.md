# Deck Studio and deck.job.v1

Deck Studio turns pasted source material into an editable presentation outline without calling an
AI provider. The browser does not fetch evidence URLs, execute instructions found in the source,
upload files, publish content, or render PowerPoint.

## User flow

1. Add a title, one objective, audience, format and source text.
2. Create a deterministic draft.
3. Edit slide titles, bullets and speaker notes; reorder, add or remove slides.
4. Move the deck to review.
5. Confirm claims, content rights and the final manual review.
6. Export deck.job.v1.json.

The exported artifact is a handoff contract, not a .pptx file. Consumers must validate it against
[the JSON schema](../contracts/deck.job.v1.schema.json), keep imported content untrusted and reset
source approval at their own trust boundary.

## Safety boundary

- Maximum input: 96 KB; source text: 60,000 characters.
- Maximum evidence links: 12; only HTTPS; credentials in URLs are rejected.
- Maximum slides: 20; maximum bullets per slide: 8.
- externalActions, toolsAllowed, sourceContentTrusted, autoPublishAllowed and pptxRendered are fixed
  to false.
- approved requires three explicit human confirmations.

## Planned consumers

- Educator-AI: lesson outline and speaker notes.
- Eclipse Chat: project/client recap review room.
- A separate renderer: approved JSON to editable PPTX with theme, citations and deterministic
  rendering. Until that renderer is implemented and verified, the UI must not claim PPTX output.
