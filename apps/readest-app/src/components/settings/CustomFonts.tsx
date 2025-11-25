import clsx from 'clsx';
import React, { useState } from 'react';
import { MdAdd, MdDelete, MdVisibility } from 'react-icons/md';
import { IoMdCloseCircleOutline } from 'react-icons/io';
import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/store/settingsStore';
import { useCustomFontStore } from '@/store/customFontStore';
import { useFileSelector } from '@/hooks/useFileSelector';
import { saveViewSettings } from '@/helpers/settings';
import { CustomFont, mountCustomFont } from '@/styles/fonts';
import FontPreview from './FontPreview';

interface CustomFontsProps {
  bookKey: string;
  onBack: () => void;
}

type FontFamily = {
  name: string;
  fonts: CustomFont[];
};

const CustomFonts: React.FC<CustomFontsProps> = ({ bookKey, onBack }) => {
  const _ = useTranslation();
  const { appService, envConfig } = useEnv();
  const { settings } = useSettingsStore();
  const {
    fonts: customFonts,
    addFont,
    loadFont,
    removeFont,
    getAvailableFonts,
    saveCustomFonts,
  } = useCustomFontStore();
  const { getViewSettings } = useReaderStore();
  const viewSettings = getViewSettings(bookKey) || settings.globalViewSettings;
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [previewFont, setPreviewFont] = useState<CustomFont | null>(null);

  const { selectFiles } = useFileSelector(appService, _);

  const currentDefaultFont =
    viewSettings.defaultFont.toLowerCase() === 'serif' ? 'serif' : 'sans-serif';

  const currentFontFamily =
    currentDefaultFont === 'serif' ? viewSettings.serifFont : viewSettings.sansSerifFont;

  const handleImportFont = () => {
    selectFiles({ type: 'fonts', multiple: true }).then(async (result) => {
      if (result.error || result.files.length === 0) return;
      for (const selectedFile of result.files) {
        const fontInfo = await appService?.importFont(selectedFile.path || selectedFile.file);
        if (!fontInfo) continue;

        const customFont = addFont(fontInfo.path, {
          name: fontInfo.name,
          family: fontInfo.family,
          style: fontInfo.style,
          weight: fontInfo.weight,
          variable: fontInfo.variable,
        });
        console.log('Added custom font:', customFont);
        if (customFont && !customFont.error) {
          const loadedFont = await loadFont(envConfig, customFont.id);
          mountCustomFont(document, loadedFont);
        }
      }
      saveCustomFonts(envConfig);
    });
  };

  const handleDeleteFamily = (family: FontFamily) => {
    for (const font of family.fonts) {
      if (font) {
        if (removeFont(font.id)) {
          appService?.deleteFont(font);
          saveCustomFonts(envConfig);
          if (getAvailableFonts().length === 0) {
            setIsDeleteMode(false);
          }
        }
      }
    }
  };

  const handleSelectFamily = (family: FontFamily) => {
    if (currentDefaultFont === 'serif') {
      saveViewSettings(envConfig, bookKey, 'serifFont', family.name);
    } else {
      saveViewSettings(envConfig, bookKey, 'sansSerifFont', family.name);
    }
  };

  const toggleDeleteMode = () => {
    setIsDeleteMode(!isDeleteMode);
  };

  const getAvailableFamilies = (fonts: CustomFont[]): FontFamily[] => {
    const familyMap = new Map<string, string[]>();

    for (const font of fonts) {
      const family = font.family || font.name;
      if (!familyMap.has(family)) {
        familyMap.set(family, []);
      }
      familyMap.get(family)!.push(font.id);
    }

    return Array.from(familyMap.entries()).map(([family, ids]) => ({
      name: family,
      fonts: ids.map((id) => fonts.find((f) => f.id === id)!).filter((f): f is CustomFont => !!f),
    }));
  };

  const availableFonts = customFonts
    .filter((font) => !font.deletedAt)
    .sort((a, b) => (b.downloadedAt || 0) - (a.downloadedAt || 0));

  const availableFamilies = getAvailableFamilies(availableFonts);

  const getFontVariantInfo = (fonts: CustomFont[]): string => {
    const weights = new Set(fonts.map(f => f.weight || 400));
    const styles = new Set(fonts.map(f => f.style || 'normal'));
    const hasVariable = fonts.some(f => f.variable);

    if (hasVariable) return 'Variable';

    const parts: string[] = [];
    if (weights.size > 1) parts.push(`${weights.size} weights`);
    if (styles.has('italic') || styles.has('oblique')) parts.push('Italic');

    return parts.length > 0 ? parts.join(', ') : `${fonts[0]?.weight || 400}`;
  };

  const handlePreviewFamily = (family: FontFamily, e: React.MouseEvent) => {
    e.stopPropagation();
    // Preview the regular weight (400) or the first font in the family
    const regularFont = family.fonts.find(f => f.weight === 400) || family.fonts[0];
    if (regularFont) {
      setPreviewFont(regularFont);
    }
  };

  return (
    <div className='w-full'>
      {previewFont && (
        <FontPreview font={previewFont} onClose={() => setPreviewFont(null)} />
      )}
      <div className='mb-6 flex h-8 items-center justify-between'>
        <div className='breadcrumbs py-1'>
          <ul>
            <li>
              <button className='font-semibold' onClick={onBack}>
                {_('Font')}
              </button>
            </li>
            <li className='font-medium'>{_('Custom Fonts')}</li>
          </ul>
        </div>
        {availableFonts.length > 0 && (
          <button
            onClick={toggleDeleteMode}
            className={`btn btn-ghost btn-sm text-base-content gap-2`}
            title={isDeleteMode ? _('Cancel Delete') : _('Delete Font')}
          >
            {isDeleteMode ? (
              <>{_('Cancel')}</>
            ) : (
              <>
                <MdDelete className='h-4 w-4' />
                {_('Delete')}
              </>
            )}
          </button>
        )}
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='card border-primary/50 hover:border-primary/75 group h-16 border-2 transition-colors'>
          <button
            className='card-body flex cursor-pointer items-center justify-center p-2 text-center'
            onClick={handleImportFont}
          >
            <div className='flex items-center gap-2'>
              <div className='flex items-center justify-center'>
                <MdAdd className='text-primary/85 group-hover:text-primary h-6 w-6' />
              </div>
              <div className='text-primary/85 group-hover:text-primary line-clamp-1 font-medium'>
                {_('Import Font')}
              </div>
            </div>
          </button>
        </div>

        {availableFamilies.map((family) => (
          <div
            role='none'
            key={family.name}
            className={clsx(
              'card group relative border shadow-sm transition-all',
              currentFontFamily === family.name
                ? 'border-primary/50 bg-primary/50'
                : `border-base-200 bg-base-200 ${isDeleteMode ? '' : 'cursor-pointer hover:border-primary/30'}`,
            )}
            onClick={!isDeleteMode ? () => handleSelectFamily(family) : undefined}
            title={family.fonts.map((f) => f.name).join('\n')}
          >
            <div className='card-body flex flex-col items-start justify-center gap-1 p-3'>
              <div
                style={{
                  fontFamily: `"${family.name}", sans-serif`,
                  fontWeight: 400,
                }}
                className='text-base-content line-clamp-1 w-full break-all font-medium'
              >
                {family.name}
              </div>
              <div className='flex w-full items-center justify-between gap-2'>
                <span className='text-base-content/60 line-clamp-1 text-xs'>
                  {getFontVariantInfo(family.fonts)}
                </span>
                {!isDeleteMode && (
                  <button
                    onClick={(e) => handlePreviewFamily(family, e)}
                    className='btn btn-ghost btn-xs opacity-0 transition-opacity group-hover:opacity-100'
                    title={_('Preview Font')}
                  >
                    <MdVisibility className='h-4 w-4' />
                  </button>
                )}
              </div>
              {isDeleteMode && (
                <button
                  onClick={() => handleDeleteFamily(family)}
                  className='btn btn-ghost btn-xs absolute right-[-10px] top-[-10px] h-6 min-h-0 w-6 p-0 hover:bg-transparent'
                  title={_('Delete Font')}
                >
                  <IoMdCloseCircleOutline className='text-base-content/75 h-6 w-6' />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className='bg-base-200/30 my-8 rounded-lg p-4'>
        <div className='text-base-content/70 text-sm sm:text-xs'>
          <div className='mb-1 indent-2 font-medium'>{_('Tips')}:</div>
          <ul className='list-outside list-disc space-y-1 ps-2'>
            <li>{_('Supported font formats: .ttf, .otf, .woff, .woff2')}</li>
            <li>{_('Custom fonts can be selected from the Font Face menu')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CustomFonts;
