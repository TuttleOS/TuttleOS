# What we built tonight — CM work queues (July 22, 2026)

**For:** Michael Tuttle  
**From:** Eng / Brett  

---

## Canonical testing guide

**Use Version updates in the app** (left nav → **Version updates**). The current card is the full testing guide:

- What each queue does (table)  
- Live vs preview  
- 10-minute walkthrough  
- Thumbs / Happy with testing / notes / screenshots  

Preview home: https://tuttle-os-git-cm-work-queues-tuttle-os.vercel.app  

This markdown is a short handoff copy; the in-app Version updates card is the source of truth for testing.

---

## One-sentence summary

We shipped the five **Case Manager assembly-line work queues** you asked for on July 22 — derived from live data, with deep-links into the right case card — plus Version updates with a full testing guide and review panel.

---

## What is live vs what is not

| | Production (`main`) | Preview (`cm-work-queues`) |
|---|---|---|
| Version updates + testing guide + review panel | Yes | Yes |
| Five CM work-queue tabs | **No** | **Yes** |

**Next step when you are happy:** tell Brett to **merge `cm-work-queues` into `main`**.

---

*Questions or a failed smoke step → reply in plain English and we fix on the branch before merge.*
