# Images

darkcode can **create and change images inline**, as a first-class agent tool. There is no `/image`
command - you just ask in plain language and the model calls the `image` tool itself; the gateway runs
the workflow on your GPU box and the result is saved into your workspace.

All of this runs on **your** Dark-LLM gateway - no third-party image service.

## Modes at a glance

| Mode | Trigger | Model | Speed |
|---|---|---|---|
| 🖼 **Generate** (text → image) | just describe it | Z-Image Turbo | ~24 s |
| ✏️ **Edit** (image → image) | *attach a photo* + a change | Qwen-Image-Edit-2511 + Lightning | ~10-15 s warm |
| 🤸 **Pose** (copy a pose) | *attach 2 images* + "do this pose" | AnyPose | ~5-15 s warm |
| 🩹 **Inpaint** (masked regen) | *attach image + mask* + a change | Qwen-Image + AliMama inpaint ControlNet | ~10-15 s warm |

The edit and pose modes **condition on your real photo**, so your subject's identity is preserved.
Inpaint goes further: everything outside the mask is preserved **pixel-for-pixel**.

## Generate

Describe the image; optionally give a size or aspect ratio.

```
generate a purple robot mascot, square
make a wide 16:9 landscape of neon mountains
make a 512x512 icon of a fox, save it to ./assets/fox.png
```

- **Ratios work by name or pixels.** The tool maps ratios to ~1-megapixel sizes: `1:1`→1024×1024,
  `16:9`→1344×768, `9:16`→768×1344, `3:2`→1216×832, `4:3`→1152×896 (and their inverses).
- Saved as `image-<timestamp>.png` in your workspace, or the path you name.

## Edit (image → image)

**Attach a photo** and say what to change. The attached image is used automatically - no file path needed.

```
[attach photo]  replace her shirt with a red party dress
[attach photo]  add a beige beret, tilted slightly left
[attach photo]  change the background to a birthday party
[attach person] [attach a coke can]  make her hold the coke can
```

- **Localized edits keep identity best** - swapping clothes, adding accessories/objects, changing the
  background. These barely touch the face, so it stays your subject.
- **Big changes drift.** "Move her to a new pose / new scene" re-renders the whole person and her face
  can change - for pose changes use **Pose mode** (below).
- To edit a file on disk instead of an attachment, name it: `edit ./logo.png to add a wizard hat`.

## Pose (copy a pose, keep identity)

The hard case - changing *how* someone stands while keeping *who* they are. Attach **two images**:

1. **First** = the person to re-pose.
2. **Second** = the pose you want copied.

```
[attach her photo] [attach the target pose]  make her do this pose
[attach subject]  [attach a yoga pose]        copy this exact pose
```

Backed by **AnyPose** (a Qwen-Image-Edit-2511 LoRA). Tips from real use:

- Works best when the **subject photo shows the full body and the floor** - less guessing.
- Background changed unexpectedly? Add: *"replace the background of image 2 with the background of image 1."*
- A hidden body part gets filled in? Tell it what it is: *"she is wearing white leggings."*
- Trained on 3D poses - great for photos, weak on flat/cel-shaded 2D art.

## Inpaint (change only a masked region)

The surgical option: regenerate **only** the area you paint, leaving everything else untouched.
Attach **two images**:

1. **First** = the base image.
2. **Second** = a **mask** the same size as the base - **white** marks the area to regenerate,
   black is kept.

```
[attach photo] [attach mask]  put a hot air balloon in the white area
[attach room]  [attach mask]  replace the masked wall with a bookshelf
```

- Everything outside the white mask is preserved **pixel-for-pixel** (a real ControlNet mask,
  not a "try not to touch it" prompt).
- Backed by the **Qwen-Image AliMama inpainting ControlNet** on the base Qwen-Image model.
- The mask is the catch: you need to supply one. This is the advanced mode - for everyday "change
  her shirt" edits, plain **Edit** is easier because it needs no mask.

## How it works

- The chat model emits a **tool call** to `image` with a `mode` (`generate` / `edit` / `pose` /
  `inpaint`), the prompt, and - for edit/pose/inpaint - the attached image(s), which the tool pulls
  out of your message.
- darkcode POSTs to the gateway's image routes (`/v1/images/generations` or `/v1/images/edits`) with
  your signed-in key, decodes the returned PNG, and **writes it into your workspace**.
- The **first** image call in a session asks a one-time permission (`image`). If an image path points
  *outside* your project folder, you get a second prompt naming that folder - a safety guard on
  model-controlled paths.

## Vision vs. the image tool

Attaching an image does **not** always mean "make an image". darkcode's rule:

- **Vision (no tool):** you drop a screenshot/photo and want darkcode to *read* it or *act on what it
  shows* - "what is this", "build this UI", "fix the bug in this screenshot", "extract the text". It
  just looks and answers / writes code. No image is produced.
- **Image tool:** you want an image *out* - "generate ...", "edit this photo: ...", "make her do this
  pose", "inpaint the masked area". Then it calls the tool.

## Nudging the model

The models are local and less reliable at tool-calling than a frontier model. If it *describes* an
image instead of making one, be explicit:

```
use the image tool to generate ...
edit this image: <change>          # 'edit this image' reliably triggers the edit mode
```

For pose, remember the order: **person first, pose second.** For inpaint: **base first, mask second.**
