import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useEnv } from '@/context/EnvContext';
import { saveViewSettings } from '@/helpers/settings';

interface FontPreset {
  id: string;
  name: string;
  description: string;
  serifFont: string;
  sansSerifFont: string;
  monospaceFont: string;
  category: 'classic' | 'modern' | 'minimalist' | 'reading' | 'cjk';
}

const FONT_PRESETS: FontPreset[] = [
  {
    id: 'classic-reading',
    name: 'Classic Reading',
    description: 'Traditional fonts optimized for long-form reading',
    serifFont: 'Literata',
    sansSerifFont: 'Roboto',
    monospaceFont: 'Courier New',
    category: 'classic',
  },
  {
    id: 'modern-clean',
    name: 'Modern & Clean',
    description: 'Contemporary fonts with excellent clarity',
    serifFont: 'Roboto Slab',
    sansSerifFont: 'Open Sans',
    monospaceFont: 'Fira Code',
    category: 'modern',
  },
  {
    id: 'minimalist',
    name: 'Minimalist',
    description: 'Simple, distraction-free reading experience',
    serifFont: 'PT Serif',
    sansSerifFont: 'PT Sans',
    monospaceFont: 'PT Mono',
    category: 'minimalist',
  },
  {
    id: 'elegant-reading',
    name: 'Elegant Reading',
    description: 'Sophisticated fonts for immersive reading',
    serifFont: 'Merriweather',
    sansSerifFont: 'Noto Sans',
    monospaceFont: 'Consolas',
    category: 'reading',
  },
  {
    id: 'versatile',
    name: 'Versatile',
    description: 'Well-balanced fonts for all content types',
    serifFont: 'Bitter',
    sansSerifFont: 'Roboto',
    monospaceFont: 'Fira Code',
    category: 'modern',
  },
  {
    id: 'cjk-optimized',
    name: 'CJK Optimized',
    description: 'Best fonts for Chinese, Japanese, and Korean texts',
    serifFont: 'LXGW WenKai GB Screen',
    sansSerifFont: 'Noto Sans SC',
    monospaceFont: 'Fira Code',
    category: 'cjk',
  },
];

interface FontPresetsProps {
  bookKey: string;
  currentSerifFont: string;
  currentSansSerifFont: string;
  currentMonospaceFont: string;
  onApplyPreset?: () => void;
}

const FontPresets: React.FC<FontPresetsProps> = ({
  bookKey,
  currentSerifFont,
  currentSansSerifFont,
  currentMonospaceFont,
  onApplyPreset,
}) => {
  const _ = useTranslation();
  const { envConfig } = useEnv();

  const handleApplyPreset = async (preset: FontPreset) => {
    await saveViewSettings(envConfig, bookKey, 'serifFont', preset.serifFont);
    await saveViewSettings(envConfig, bookKey, 'sansSerifFont', preset.sansSerifFont);
    await saveViewSettings(envConfig, bookKey, 'monospaceFont', preset.monospaceFont);
    onApplyPreset?.();
  };

  const isCurrentPreset = (preset: FontPreset): boolean => {
    return (
      currentSerifFont === preset.serifFont &&
      currentSansSerifFont === preset.sansSerifFont &&
      currentMonospaceFont === preset.monospaceFont
    );
  };

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between'>
        <h3 className='font-medium'>{_('Font Presets')}</h3>
        <span className='text-base-content/60 text-xs'>{_('Quick font combinations')}</span>
      </div>

      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
        {FONT_PRESETS.map((preset) => {
          const isActive = isCurrentPreset(preset);

          return (
            <button
              key={preset.id}
              onClick={() => handleApplyPreset(preset)}
              className={`card border shadow-sm text-left transition-all ${
                isActive
                  ? 'border-primary bg-primary/10'
                  : 'border-base-200 bg-base-200 hover:border-primary/50'
              }`}
            >
              <div className='card-body p-4'>
                <div className='mb-2 flex items-start justify-between'>
                  <h4 className='font-semibold'>
                    {_(preset.name)}
                    {isActive && (
                      <span className='badge badge-primary badge-sm ml-2'>{_('Active')}</span>
                    )}
                  </h4>
                </div>
                <p className='text-base-content/70 mb-3 text-xs'>{_(preset.description)}</p>
                <div className='space-y-1 text-xs'>
                  <div className='flex items-center justify-between'>
                    <span className='text-base-content/60'>{_('Serif')}:</span>
                    <span
                      className='font-medium'
                      style={{ fontFamily: `"${preset.serifFont}", serif` }}
                    >
                      {preset.serifFont}
                    </span>
                  </div>
                  <div className='flex items-center justify-between'>
                    <span className='text-base-content/60'>{_('Sans-serif')}:</span>
                    <span
                      className='font-medium'
                      style={{ fontFamily: `"${preset.sansSerifFont}", sans-serif` }}
                    >
                      {preset.sansSerifFont}
                    </span>
                  </div>
                  <div className='flex items-center justify-between'>
                    <span className='text-base-content/60'>{_('Monospace')}:</span>
                    <span
                      className='font-medium'
                      style={{ fontFamily: `"${preset.monospaceFont}", monospace` }}
                    >
                      {preset.monospaceFont}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className='bg-base-200/30 rounded-lg p-3'>
        <p className='text-base-content/70 text-xs'>
          <strong>{_('Tip')}:</strong> {_('Font presets provide curated combinations optimized for different reading styles. You can always customize individual fonts afterward.')}
        </p>
      </div>
    </div>
  );
};

export default FontPresets;
