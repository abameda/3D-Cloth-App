# ChatGPT prompts for the Thread 3D character

These prompts produce reference images for a 3D artist or reconstruction workflow. They do not produce a rigged GLB file, usable UV textures or simulated clothing by themselves.

## 1. Base character reference

Paste into ChatGPT image generation:

> Create a professional 3D character modeling reference sheet for an adult character in a premium personal wardrobe app. Choose an original generic adult test character, with medium warm-brown skin, short dark textured hair, brown eyes, balanced natural body proportions and an approachable neutral expression. The visual style is refined stylized realism: sculpted features, believable anatomy, matte skin and modeled hair, with enough simplification for a mobile 3D character. Avoid a toy-like oversized head.
>
> Show four separate, equally sized, full-body orthographic views of exactly the same character: front, left profile, back and right profile. Align the head, shoulders, pelvis, knees and soles consistently across all views. Use a neutral A-pose, arms approximately 30 degrees away from the torso, open relaxed hands with fingers visible, and feet shoulder-width apart. Clothing is only a fitted opaque neutral-grey short-sleeve base top and fitted mid-thigh shorts, barefoot, with no logos or accessories. Keep the hairstyle and anatomy consistent in every view.
>
> Use a plain light-grey background, neutral diffuse illumination, minimal contact shadows, no dramatic perspective, no lens distortion, no depth of field and no scenic setting. Leave clean space between the views. Show the entire body without cropping. Favor clear silhouette and anatomical consistency over cinematic beauty. Do not add decorative graphics, sample fabric swatches or interface mockups.

If matching your own character later, attach your reference and replace the first paragraph with: “Preserve the attached character's identity, face, hair, proportions and distinctive details across every view. Treat the attachment as the identity source.”

## 2. Matching clothing references

Use the approved character image as an attachment, then paste:

> Using this exact character and its proportions as the fit reference, create a professional modeling reference sheet for one complete everyday outfit: an ivory heavyweight crew-neck T-shirt, straight-leg charcoal trousers, clean off-white low-top sneakers and an unzipped muted forest-green overshirt. Use realistic garment construction, restrained fabric texture and no branding.
>
> Show aligned front, left side and back orthographic views of the same dressed character in the same A-pose. Keep all seams, lengths, sleeve openings, collars, cuffs and shoe details consistent across views. Make the overshirt open enough to reveal the T-shirt. Show garment thickness and plausible layering without exaggerated wrinkles or floating fabric. Use neutral diffuse lighting and a plain light-grey background. Full body, no cropped feet, no dramatic perspective.
>
> This is a reference for separate 3D garment meshes fitted to one base body. It is not an advertisement or fashion illustration. Prioritize clear garment boundaries and repeatable construction.

For cleaner modeling, generate one additional sheet per garment, showing only that garment from front, side and back. Attach the approved outfit each time and explicitly preserve its cut, color and construction. Review consistency between images before modeling.

## 3. Brief to turn approved references into usable assets

Give the images and this brief to a 3D artist or a coding/modeling workflow with Blender access:

> Build an original mobile-ready character and separate fitted garment objects from these approved references. Deliver a self-contained GLB with embedded textures, a neutral A-pose, meters as the unit and Y-up glTF orientation. Keep the character centered with feet at ground height. Name the body, hair, top, trousers, left shoe, right shoe and outerwear objects clearly. Use compatible PBR materials and avoid reliance on external texture URLs or Blender-only shaders. Garments must remain separate and independently selectable; avoid baking the outfit permanently into the body. Inspect front, side and back views for clipping and missing surfaces. Deliver source files, asset license/provenance and a material/object inventory. Begin with a modest mobile geometry and texture budget and validate it on the target phone before increasing detail. Do not claim that these meshes predict real-world body fit.
