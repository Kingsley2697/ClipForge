// src/lib/presets.ts — Campaign Preset Rules Configuration

export type CampaignPreset = "VYRO" | "WHOP" | "SPORTS" | "GENERAL";

export interface PresetConfig {
  id: CampaignPreset;
  name: string;
  tagline: string;
  maxDuration: number; // seconds
  minDuration: number; // seconds
  aspectRatio: string; // e.g. "9:16"
  minResolutionHeight?: number; // e.g. 720
  speedModifier?: number; // e.g. 1.02 for SPORTS
  captionStyle: {
    fontName: string;
    fontSize: number;
    primaryColor: string; // ASS hex &HAABBGGRR
    secondaryColor: string;
    outlineColor: string;
    backColor: string;
    bold: boolean;
    alignment: number; // 2 = bottom-center, 5 = center
    marginV: number;
    highlightYellow?: boolean;
  };
  hasTopBannerHook: boolean;
  generateTranscriptFile: boolean;
  aiPromptDirectives: string;
}

export const CAMPAIGN_PRESETS: Record<CampaignPreset, PresetConfig> = {
  VYRO: {
    id: "VYRO",
    name: "VYRO Mode",
    tagline: "Hyper-fast pacing with high-contrast yellow/white captions (max 45s)",
    maxDuration: 45,
    minDuration: 15,
    aspectRatio: "9:16",
    minResolutionHeight: 720,
    captionStyle: {
      fontName: "Montserrat",
      fontSize: 88,
      // High-contrast yellow primary color (&H0000FFFF in BGR is pure Yellow)
      primaryColor: "&H0000FFFF",
      secondaryColor: "&H00FFFFFF",
      outlineColor: "&H00000000",
      backColor: "&H90000000",
      bold: true,
      alignment: 2, // bottom-center
      marginV: 140,
      highlightYellow: true,
    },
    hasTopBannerHook: false,
    generateTranscriptFile: false,
    aiPromptDirectives: `CAMPAIGN: VYRO Mode.
- MAXIMUM duration is strictly 45 seconds (ideal range 25-42 seconds).
- Prioritize hyper-fast speech pacing, sudden punchlines, high retention hooks in the first 3 seconds.
- Discard long build-ups; start directly at the climax or core revelation.
- Rate hook urgency aggressively (reward high information density).`,
  },

  WHOP: {
    id: "WHOP",
    name: "WHOP Mode",
    tagline: "Commercial conversion hooks, top banner overlay & exported transcripts",
    maxDuration: 60,
    minDuration: 25,
    aspectRatio: "9:16",
    captionStyle: {
      fontName: "Montserrat",
      fontSize: 82,
      primaryColor: "&H00FFFFFF", // White
      secondaryColor: "&H0000FFFF",
      outlineColor: "&H00000000",
      backColor: "&H80000000",
      bold: true,
      alignment: 2, // bottom-center
      marginV: 130,
    },
    hasTopBannerHook: true,
    generateTranscriptFile: true,
    aiPromptDirectives: `CAMPAIGN: WHOP Mode (High-Converting Creator/Offer Content).
- MAXIMUM duration is strictly 60 seconds (ideal range 35-55 seconds).
- Optimize for curiosity gaps, entrepreneurial advice, actionable insights, case studies, or high-value tips.
- For each segment, formulate an irresistible "hookText" (maximum 8-10 words) intended for a prominent top-of-screen banner (e.g. "HOW TO MAKE $10K/MO WITHOUT ADS", "THE SECRET NOBODY TELLS YOU").
- Must provide clean spoken payload suitable for companion .txt transcript distribution.`,
  },

  SPORTS: {
    id: "SPORTS",
    name: "SPORTS Mode",
    tagline: "1.02x speed copyright-bypass, action spikes & dynamic motion framing",
    maxDuration: 60,
    minDuration: 15,
    aspectRatio: "9:16",
    speedModifier: 1.02, // 1.02x video + audio speed to bypass automated content ID scanners
    captionStyle: {
      fontName: "Impact",
      fontSize: 92,
      primaryColor: "&H0000FFFF", // Neon Yellow / Gold
      secondaryColor: "&H00FFFFFF",
      outlineColor: "&H00000000",
      backColor: "&HA0000000",
      bold: true,
      alignment: 2,
      marginV: 150,
      highlightYellow: true,
    },
    hasTopBannerHook: false,
    generateTranscriptFile: false,
    aiPromptDirectives: `CAMPAIGN: SPORTS Mode (Football, Combat, High-CPM Sports & Action).
- MAXIMUM duration is strictly 60 seconds.
- Prioritize intense action spikes, dramatic commentary shouts, crowd explosions, clutch plays, and controversial decisions.
- Look for peak acoustic and emotional energy (referee drama, buzzer beaters, goals, knockouts).
- Hook score should reflect adrenaline, jaw-dropping athleticism, and re-watchability.`,
  },

  GENERAL: {
    id: "GENERAL",
    name: "GENERAL Mode",
    tagline: "Standard 9:16 vertical clips with clean subtitles for any niche",
    maxDuration: 60,
    minDuration: 20,
    aspectRatio: "9:16",
    captionStyle: {
      fontName: "Montserrat",
      fontSize: 82,
      primaryColor: "&H00FFFFFF",
      secondaryColor: "&H00FFFFFF",
      outlineColor: "&H00000000",
      backColor: "&H80000000",
      bold: true,
      alignment: 2,
      marginV: 120,
    },
    hasTopBannerHook: false,
    generateTranscriptFile: false,
    aiPromptDirectives: `CAMPAIGN: GENERAL Mode.
- Balanced 30-60 second clips.
- Standard viral short format with clear story hook, engagement, and satisfying takeaway.`,
  },
};

/**
 * Get the preset configuration object safely with fallback to GENERAL.
 */
export function getPresetConfig(preset?: string | null): PresetConfig {
  const normalized = (preset || "GENERAL").toUpperCase() as CampaignPreset;
  return CAMPAIGN_PRESETS[normalized] || CAMPAIGN_PRESETS.GENERAL;
}

/**
 * Validate video metadata against preset constraints.
 */
export function validateVideoForPreset(
  preset: CampaignPreset,
  meta?: { height?: number; duration?: number }
): { isValid: boolean; warning?: string } {
  const config = getPresetConfig(preset);

  if (config.minResolutionHeight && meta?.height && meta.height < config.minResolutionHeight) {
    return {
      isValid: false,
      warning: `${config.name} requires a minimum video resolution of ${config.minResolutionHeight}p (detected ${meta.height}p).`,
    };
  }

  return { isValid: true };
}
