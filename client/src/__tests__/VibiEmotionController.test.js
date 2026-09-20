import { describe, it, expect, beforeEach, vi } from 'vitest';
import vibiEmotionController, { VIBI_EMOTIONS, EMOTION_CONFIGS } from '../services/vibiEmotionController';

describe('VibiEmotionController', () => {
  beforeEach(() => {
    vibiEmotionController.resetToIdle();
  });

  it('contains exactly 20 distinct emotions', () => {
    const emotions = vibiEmotionController.getAllEmotions();
    expect(emotions).toHaveLength(20);
    expect(emotions).toEqual([
      'idle', 'welcome', 'attentive', 'listening', 'thinking', 'curious',
      'happy', 'excited', 'playful', 'surprised', 'confused', 'concerned',
      'sad', 'frustrated', 'proud', 'success', 'error', 'celebrating',
      'sleepy', 'responding'
    ]);
  });

  it('each emotion has a complete visual specification config', () => {
    const emotions = vibiEmotionController.getAllEmotions();
    emotions.forEach((emotion) => {
      const config = vibiEmotionController.getEmotionConfig(emotion);
      expect(config).toBeDefined();
      expect(config.name).toBeTruthy();
      expect(config.description).toBeTruthy();
      expect(config.eyes).toBeTruthy();
      expect(config.ears).toBeTruthy();
      expect(config.mouth).toBeTruthy();
      expect(config.head).toBeTruthy();
      expect(config.body).toBeTruthy();
      expect(config.tail).toBeTruthy();
      expect(config.vEmblem).toBeDefined();
      expect(config.vEmblem.primaryColor).toMatch(/^#[0-9A-F]{6}$/i);
      expect(config.vEmblem.pulseDuration).toBeTruthy();
    });
  });

  it('transitions state and notifies subscribers', () => {
    const subscriber = vi.fn();
    const unsub = vibiEmotionController.subscribe(subscriber);

    vibiEmotionController.setEmotion(VIBI_EMOTIONS.HAPPY);
    expect(vibiEmotionController.getEmotion()).toBe('happy');
    expect(subscriber).toHaveBeenCalledWith('happy', expect.objectContaining({ name: 'Happy' }), expect.any(Object));

    unsub();
  });

  it('respects priority levels and prevents lower priority overwrites', () => {
    // Set high priority ERROR (priority 6)
    vibiEmotionController.setEmotion(VIBI_EMOTIONS.ERROR, { priority: 6 });
    expect(vibiEmotionController.getEmotion()).toBe('error');

    // Attempt lower priority HAPPY (priority 2) without force -> should be rejected
    const accepted = vibiEmotionController.setEmotion(VIBI_EMOTIONS.HAPPY, { priority: 2 });
    expect(accepted).toBe(false);
    expect(vibiEmotionController.getEmotion()).toBe('error');

    // Force option bypasses priority check
    const forced = vibiEmotionController.setEmotion(VIBI_EMOTIONS.HAPPY, { force: true });
    expect(forced).toBe(true);
    expect(vibiEmotionController.getEmotion()).toBe('happy');
  });

  it('records transition history', () => {
    vibiEmotionController.setEmotion(VIBI_EMOTIONS.CURIOUS);
    vibiEmotionController.setEmotion(VIBI_EMOTIONS.PLAYFUL);
    vibiEmotionController.setEmotion(VIBI_EMOTIONS.PROUD);

    const history = vibiEmotionController.getHistory();
    expect(history.length).toBeGreaterThanOrEqual(3);
    expect(history[0].to).toBe('proud');
    expect(history[1].to).toBe('playful');
    expect(history[2].to).toBe('curious');
  });
});
