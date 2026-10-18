# Tamagot: roadmap

## Next features, best value first

1. **Sound** (small): use the Web Audio API to make sounds in code, with no audio files: chomp, giggle, squeak on landing, egg crack, level-up jingle, a soft "boop" for buttons. Add a mute toggle saved in localStorage. Start audio only after the first user tap.
2. **Breeding** (medium):
   - Two Adults make an egg, with the child seed `A×B`.
   - Each gene comes from parent A or parent B by a coin from the child's own stream, with a 2% chance per gene of rolling fresh.
   - This needs a "Gen 2" decode path that takes parent DNA instead of rolling genes. Show the parents on the egg card.
3. **Pet room** (medium): a small 3D room with a floor, a bed, a food bowl and a toy box. Care scenes walk to them, for example eating from the bowl or sleeping in the bed. Daylight follows the real clock.
4. **More life:**
   - Sickness (from neglect), cured with a medicine button.
   - Pet waste to clean up.
   - Moods with a visible face (sad brows, angry puff).
   - Aging past Adult into an Elder stage.
   - "Runs away" after long neglect. Keep it gentle.
5. **Adult evolution by stats:** the "Born with" stats (appetite, stamina, charm) could change the form's strength or unlock rare forms. For example, high stamina plus Sporty gives an "Athlete".
6. **Collection:** keep several pets, a gallery of past adults, and an export to PNG or GLB (Three.js GLTFExporter) for sharing, AR or 3D printing.
7. **Accounts and a global registry** (large):
   - Save pets in a backend such as Supabase or Firebase.
   - When a pet becomes an Adult, register `(seed, fingerprint, form, moon, hist hash)` so that no two owners can register the same pet.
   - Sync across devices and add a friends' park.
8. **Project setup:** move to Vite + TypeScript + Three.js modules (r160+), with separate files for genome, builder, motion, life and ui, plus unit tests in Vitest. Keep `genome` dependency-free.

## Known issues and limits

- **Growth speed is a demo setting:** Adult takes about 25 care actions, or about 8 hours of passive time. A real game should take days. Tune `XP_AT` and the time rates.
- **One pet per browser:** localStorage only. Clearing site data loses the pet.
- **Internet needed:** Three.js and the fonts load from CDNs. Bundle them locally for offline or app-store builds.
- **Uniqueness is only within the app:** typed seeds can be reused by anyone (that's how twins work). Global uniqueness needs item 7.
- **Stage-ups cancel scenes:** a stage-up in the middle of a feed or play scene removes the apple or ball (`showModel` calls `resetMotion`).
- **Food can be hidden:** on some camera angles the apple sits behind the pet while it eats.
- **The design canvas is out of date:** the 2D boards in `design-canvas/` show the first concept (no stages, fine DNA or raising forms). Their genome code is an older copy without fine DNA. Refresh them if the canvas will be used for presentations.
- **The adult-forms row costs some time:** it renders 6 offscreen thumbnails the first time (cached after that). That's fine on desktop; check it on low-end phones.
