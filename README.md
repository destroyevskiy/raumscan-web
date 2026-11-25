# Raumscan hosted deployment

The site branch contains the public browser application. This branch is a Render Blueprint for a Frankfurt pilot. The prototype's source repository and uploaded walkthroughs are private.

The bootstrap service derives a dedicated SSH key from its Render-managed secret. An operator enrolls only its public key as a read-only GitHub deploy key on the Raumscan repository and registers its processor digest with the dedicated Supabase project. The service then starts the studio from the private repository. Connections verify GitHub's published Ed25519 host key.
