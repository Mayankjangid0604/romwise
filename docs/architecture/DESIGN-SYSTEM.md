# Roamwise Design System & UI Architecture

## Core Philosophy
Roamwise is a professional, trustworthy travel product. It is deliberately designed. It is not a collection of "vibecoded" AI-generated components.

### 1. Typography
- **Primary Font:** Inter (or Sans-Serif system defaults).
- **Hierarchy:** Clear and distinct. 
- **Readability:** High contrast, legible line-heights, and proper letter spacing.

### 2. Colors & Gradients
- **Primary Action Colors:** Solid, trustworthy brand colors (e.g., standard blue/indigo).
- **Avoid Excessive Gradients:** Stop using random background gradients for cards. Gradients should be reserved for high-impact hero sections, not everyday interactive elements.
- **Backgrounds:** Use subtle off-whites (`bg-gray-50`, `bg-slate-50`) or pure whites.
- **Dark Mode:** Consistent dark mode contrast ratios.

### 3. Iconography
- **No Emojis:** Do not use emojis as core UI icons. Emojis break professionalism and scale poorly across operating systems.
- **Standard Library:** Use `lucide-react` for all icons consistently. Ensure consistent stroke width and sizing (e.g., `w-4 h-4` for inline text, `w-5 h-5` or `w-6 h-6` for standalone actions).

### 4. Components

#### Cards
- Must have consistent border radii (`rounded-xl` or `rounded-2xl`).
- Use subtle borders (`border-border`) and light shadows (`shadow-sm`) instead of heavy dropshadows.
- Avoid internal scrollbars where possible.

#### Buttons
- Define standard variants: `default`, `secondary`, `outline`, `ghost`, `destructive`.
- Never use generic "vibecoded" buttons with emojis inside them.
- Always include `focus-visible:ring` for accessibility.

#### Forms & Inputs
- Standardize heights and paddings (e.g., `h-10 px-3 py-2`).
- Include distinct focus states (`focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`).
- Ensure labels and error messages are clearly tied to their inputs.

### 5. Layout & Responsiveness
- **Matrix:** The application must scale gracefully from `320px` to `1440px` and beyond.
- **No Horizontal Overflow:** All pages must use `overflow-x-hidden` appropriately on the body or wrapper, and internal flex/grid containers must wrap or scroll correctly.
- **Padding:** Consistent page-level padding (`p-4 md:p-8`).

### 6. Microinteractions & States
- **Loading:** Use skeleton loaders instead of generic spinners for complex content (e.g., trip itineraries).
- **Empty:** Deliberate empty states with a clear call-to-action, icon, and explanation.
- **Error:** Graceful error fallbacks that allow the user to recover (e.g., "Try Again" or "Return Home").
- **Hover:** Subtle hover states (`hover:bg-accent hover:text-accent-foreground`) for all interactive elements.

## Compliance
Any new component added to Roamwise MUST comply with these rules. 
"Vibecoding" (generating UI with complex gradients, emojis, and irregular padding) is strictly prohibited.
