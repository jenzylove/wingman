# Spike: post time and text without the X API

Question: can we get a post's exact time and its text for free?

Run: post ID shifted right 22 bits plus the Twitter epoch (1288834974657) gives milliseconds; publish.twitter.com/oembed returns author and text with no key.

Output (Nov 8 2026): post 1519480761749016577 -> 2022-04-28T00:56:58.845Z, oembed 200, author and full text returned.

Verdict: proven. No paid X API needed for time or text.
