# Photos

The site currently points at Unsplash CDN URLs for all photos so it looks complete out of the box. To use your own engagement photos instead, follow this:

## Option A: keep filenames, drop in your JPEGs

1. Drop your photos into this folder with the filenames below:

   | Slot | Suggested file | Where it shows |
   | --- | --- | --- |
   | Hero (big one at the top) | `hero-couple.jpg` | Top of page, full-bleed |
   | Love Story — Chapter 1 | `story-1.jpg` | "The Meeting" tab |
   | Love Story — Chapter 2 | `story-2.jpg` | "Finding Love" tab |
   | Love Story — Chapter 3 | `story-3.jpg` | "The Proposal" tab |
   | Schedule | `reception.jpg` | Right column of schedule section |
   | Get In Touch | `footer-couple.jpg` | Background of last section |

2. In `css/style.css`, replace each `background-image: url('https://images.unsplash.com/...')` line with the local path:

   ```css
   .hero__photo        { background-image: url('../assets/images/hero-couple.jpg'); }
   .story__photo--1    { background-image: url('../assets/images/story-1.jpg'); }
   .story__photo--2    { background-image: url('../assets/images/story-2.jpg'); }
   .story__photo--3    { background-image: url('../assets/images/story-3.jpg'); }
   .schedule__photo    { background-image: url('../assets/images/reception.jpg'); }
   .get-in-touch__photo{ background-image: url('../assets/images/footer-couple.jpg'); }
   ```

3. Commit and push. Done.

## Option B: just change the Unsplash URLs

If you already have photos hosted somewhere (Google Photos direct links, Dropbox, etc.), paste their URLs in place of the Unsplash ones in `css/style.css`. Same result, no files needed here.

## Photo tips for best results

- **Hero & Get-In-Touch:** moody, atmospheric photos (dusk, candlelight, winter walk) — they sit under a dark overlay so mid-range contrast photos look best.
- **Story photos:** portrait orientation (taller than wide) fills the 3:4 slot cleanly.
- **Schedule photo:** close-up of florals or a reception detail works beautifully; aspect ratio is ~4:5.
- Export at **1600–2000px wide**, **~80% JPEG quality** for a nice balance of sharpness and file size.
