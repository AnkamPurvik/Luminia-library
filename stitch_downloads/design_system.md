# Design System: My design system
**ID:** assets/18184205179850049764

## Theme Tokens
- **Color Mode:** DARK
- **Font:** INTER
- **Primary Color:** #F472B6
- **Secondary Color:** #6366F1
- **Background Color:** #0e0e0e
- **Roundness:** ROUND_EIGHT

## Design Specification (Markdown)
The "3D Forge" Layout Prompt for Stitch
Core Aesthetic: A professional, "SaaS-Plus" Dark Mode interface that seamlessly integrates soft, textured 3D objects with a sleek, minimalist dashboard grid. It combines the "Glow" effect you like with the structure of this reference image. The UI elements should have a moderate level of roundedness (default).

1. Scene & Global Styles (Tailwind)
Prompt for Stitch: "Apply these global settings to establish the high-end dark-mode theme shown in image_1.png."
AttributeValue / DescriptionBackgroundCore background: #111111 (Matte Dark Gray). Avoid pure #000 black. Add very soft, non-uniform background light blobs (mesh gradients) in a subtle violet (#7C3AED) and deep gray behind main content.BordersNo harsh borders. Use subtle shadows and backdrop blurs to define panels.Base FontInter (Semi-bold weights for headings, regular for body).Text ColorPrimary: #F9FAFB (Off-white). Secondary: #9CA3AF (Light gray).Accent ColorsPrimary (Pink): #F472B6 (Pink-400). Secondary (Indigo): #6366F1 (Indigo-500). Use these for high-light text and buttons.
2. Component Design (The "Bento" Grid)
Prompt for Stitch: "Recreate the layout of image_1.png using Bento Grid components. The right-hand column must be designed with the specific perspective seen in the image."
A. The Primary Left Column (Navigation & Hero)


Header (Logo/Nav): Use #F472B6 for the 3D FORGE logo. Keep navigation text (HOME, COURSES, etc.) in the matte gray (#9CA3AF). Ensure the hover state underlines the active link.

Hero Text: Follow the hierarchy precisely. A large heading (e.g., Your Gateway to <span class='text-pink-400'>Master 3D Design</span>) with clean spacing above and below the body paragraph.

Buttons:


"Get Started": Solid Pink-400 background (#F472B6) with soft edges (moderate roundedness).

"Watch Demo": Matte Slate (#4B5563) background, same shape. These should be aligned perfectly with the text block.

Footer Icons: Place a simple matte-gray social media icon row (IG, FB, YT, IN) in the bottom-left corner with generous margin.
B. The Secondary Right Column (The Floating HUD)
This is the most critical element to get the high-end feel.


HUD Base (The Screen): Create a rounded rectangle panel with a dark slate background (#1F2937).


Constraint: Place the floating 3D objects inside or overlapping this panel to give it depth.

Toolbar (Left HUD): Create a matte black (nearly pure black) vertical toolbar with the icons [Search, Camera, Add, Layer, Settings, Export] in a crisp, clean white. Ensure this is visually separate but aligned.

Right Toolbar/Menu (The HUD Panel): Add the list component (represented by -----) with the #6366F1 (Indigo) top header.

The Feature Tags (Floaters): Add the three specific, floating info-pills below the HUD with subtle backdrop blur and icons.


Expert-Led Curriculum (Trophy)

Interactive Learning (Goal)

Community Support (Stars)
C. The Integrated 3D Elements
Prompt for Stitch: "Instruct the asset pipeline to load the soft-textured 3D geometric shapes (green cylinder, cyan cube, gold dodecahedron) as Floating Objects (GLTF/OBJ) with very soft, diffused lighting. They must be positioned to overlap the HUD screen as seen in image_1.png."
3. Micro-Interactions & Motion
Prompt for Stitch: "Add these subtle animations to make the layout feel expansive."


Parallax Scroll: When scrolling, the main content (Text/Buttons) scrolls normally, but the floating 3D elements and the entire HUD panel scroll at half speed, giving a strong sense of depth.

Hover Reveal: As a mouse moves over a navigation link or a feature tag, add a soft Indigo glow that expands outward.

Button Scale: On hover, slightly scale up (105%) the "Get Started" and "Watch Demo" buttons with a spring animation.
Pro-Tip for Stitch:
You can ask Stitch to use Tailwind's backdrop-blur class heavily for that floating HUD panel in the right column. It makes the 3D objects look like they are behind a clean layer of glass.
