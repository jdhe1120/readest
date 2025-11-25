import React, { useState } from 'react';
import { CustomFont } from '@/styles/fonts';
import { useTranslation } from '@/hooks/useTranslation';

interface FontPreviewProps {
  font: CustomFont;
  onClose: () => void;
}

const SAMPLE_TEXTS = {
  en: 'The quick brown fox jumps over the lazy dog. ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789',
  latin: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  numbers: '0123456789 !@#$%^&*()_+-=[]{}|;:\'",.<>?/',
  sentence: 'Reading is essential to learning and personal growth.',
};

const FontPreview: React.FC<FontPreviewProps> = ({ font, onClose }) => {
  const _ = useTranslation();
  const [customText, setCustomText] = useState('');
  const [fontSize, setFontSize] = useState(18);

  const fontFamily = font.family || font.name;
  const isVariable = font.variable || false;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
      <div className='bg-base-100 w-full max-w-4xl rounded-lg shadow-xl'>
        <div className='border-base-300 flex items-center justify-between border-b px-6 py-4'>
          <div>
            <h2 className='text-xl font-semibold'>{_('Font Preview')}</h2>
            <p className='text-base-content/70 text-sm'>
              {fontFamily}
              {isVariable && (
                <span className='badge badge-primary badge-sm ml-2'>{_('Variable')}</span>
              )}
            </p>
          </div>
          <button onClick={onClose} className='btn btn-ghost btn-sm'>
            {_('Close')}
          </button>
        </div>

        <div className='max-h-[70vh] space-y-6 overflow-y-auto p-6'>
          {/* Font Size Control */}
          <div className='flex items-center gap-4'>
            <label className='font-medium'>{_('Preview Size')}:</label>
            <input
              type='range'
              min='12'
              max='48'
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className='range range-primary range-sm w-48'
            />
            <span className='text-sm'>{fontSize}px</span>
          </div>

          {/* Font Metadata */}
          <div className='bg-base-200 rounded-lg p-4'>
            <div className='grid grid-cols-2 gap-4 text-sm md:grid-cols-4'>
              <div>
                <span className='text-base-content/70'>{_('Family')}:</span>
                <p className='font-medium'>{fontFamily}</p>
              </div>
              <div>
                <span className='text-base-content/70'>{_('Weight')}:</span>
                <p className='font-medium'>{font.weight || 400}</p>
              </div>
              <div>
                <span className='text-base-content/70'>{_('Style')}:</span>
                <p className='font-medium capitalize'>{font.style || 'normal'}</p>
              </div>
              <div>
                <span className='text-base-content/70'>{_('Type')}:</span>
                <p className='font-medium'>{isVariable ? _('Variable') : _('Static')}</p>
              </div>
            </div>
          </div>

          {/* Sample Text Previews */}
          <div className='space-y-4'>
            <h3 className='font-medium'>{_('Sample Text')}</h3>

            <div className='space-y-3'>
              {Object.entries(SAMPLE_TEXTS).map(([key, text]) => (
                <div key={key} className='bg-base-200 rounded-lg p-4'>
                  <p className='text-base-content/70 mb-2 text-xs uppercase'>{_(key)}</p>
                  <p
                    style={{
                      fontFamily: `"${fontFamily}", sans-serif`,
                      fontSize: `${fontSize}px`,
                      fontWeight: font.weight || 400,
                      fontStyle: font.style || 'normal',
                    }}
                    className='break-words'
                  >
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Weight Variations (for variable fonts or to show current weight) */}
          {isVariable && (
            <div className='space-y-3'>
              <h3 className='font-medium'>{_('Weight Variations')}</h3>
              <div className='space-y-2'>
                {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((weight) => (
                  <div key={weight} className='bg-base-200 rounded-lg p-3'>
                    <div className='mb-1 flex items-center justify-between'>
                      <span className='text-base-content/70 text-xs'>
                        {_('Weight')} {weight}
                      </span>
                    </div>
                    <p
                      style={{
                        fontFamily: `"${fontFamily}", sans-serif`,
                        fontSize: '16px',
                        fontWeight: weight,
                      }}
                    >
                      {SAMPLE_TEXTS.sentence}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Style Variations */}
          <div className='space-y-3'>
            <h3 className='font-medium'>{_('Style Variations')}</h3>
            <div className='space-y-2'>
              {['normal', 'italic', 'oblique'].map((style) => (
                <div key={style} className='bg-base-200 rounded-lg p-3'>
                  <div className='mb-1 flex items-center justify-between'>
                    <span className='text-base-content/70 text-xs capitalize'>
                      {_(style)}
                    </span>
                  </div>
                  <p
                    style={{
                      fontFamily: `"${fontFamily}", sans-serif`,
                      fontSize: '16px',
                      fontStyle: style,
                      fontWeight: font.weight || 400,
                    }}
                  >
                    {SAMPLE_TEXTS.sentence}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Text Input */}
          <div className='space-y-3'>
            <h3 className='font-medium'>{_('Custom Text')}</h3>
            <textarea
              className='textarea textarea-bordered w-full'
              rows={3}
              placeholder={_('Type your own text to preview...')}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
            />
            {customText && (
              <div className='bg-base-200 rounded-lg p-4'>
                <p
                  style={{
                    fontFamily: `"${fontFamily}", sans-serif`,
                    fontSize: `${fontSize}px`,
                    fontWeight: font.weight || 400,
                    fontStyle: font.style || 'normal',
                  }}
                  className='break-words'
                >
                  {customText}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FontPreview;
