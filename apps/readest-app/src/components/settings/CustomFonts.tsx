import clsx from 'clsx';
import React, { useState } from 'react';
import { MdAdd, MdDelete, MdError, MdWarning } from 'react-icons/md';
import { IoMdCloseCircleOutline } from 'react-icons/io';
import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/store/settingsStore';
import { useCustomFontStore } from '@/store/customFontStore';
import { useFileSelector } from '@/hooks/useFileSelector';
import { saveViewSettings } from '@/helpers/settings';
import { CustomFont, mountCustomFont } from '@/styles/fonts';

interface CustomFontsProps {
  bookKey: string;
  onBack: () => void;
}

type FontFamily = {
  name: string;
  fonts: CustomFont[];
  hasError?: boolean;
  errorCount?: number;
  loadedCount?: number;
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
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string>('');

  const { selectFiles } = useFileSelector(appService, _);

  const currentDefaultFont =
    viewSettings.defaultFont.toLowerCase() === 'serif' ? 'serif' : 'sans-serif';

  const currentFontFamily =
    currentDefaultFont === 'serif' ? viewSettings.serifFont : viewSettings.sansSerifFont;

  const handleImportFont = () => {
    selectFiles({ type: 'fonts', multiple: true }).then(async (result) => {
      if (result.error || result.files.length === 0) return;

      setIsImporting(true);
      let successCount = 0;
      let errorCount = 0;

      try {
        for (let i = 0; i < result.files.length; i++) {
          const selectedFile = result.files[i];
          setImportStatus(`Importing ${i + 1}/${result.files.length}...`);

          try {
            const fontInfo = await appService?.importFont(selectedFile.path || selectedFile.file);
            if (!fontInfo) {
              errorCount++;
              continue;
            }

            const customFont = addFont(fontInfo.path, {
              name: fontInfo.name,
              family: fontInfo.family,
              style: fontInfo.style,
              weight: fontInfo.weight,
              variable: fontInfo.variable,
            });

            console.log('Added custom font:', customFont);

            if (customFont && !customFont.error) {
              try {
                const loadedFont = await loadFont(envConfig, customFont.id);
                mountCustomFont(document, loadedFont);
                successCount++;
              } catch (loadError) {
                console.error('Failed to load font:', loadError);
                errorCount++;
              }
            } else {
              errorCount++;
            }
          } catch (importError) {
            console.error('Failed to import font:', importError);
            errorCount++;
          }
        }

        saveCustomFonts(envConfig);

        // Show summary
        if (successCount > 0 && errorCount === 0) {
          setImportStatus(`Successfully imported ${successCount} font${successCount > 1 ? 's' : ''}`);
        } else if (successCount > 0 && errorCount > 0) {
          setImportStatus(`Imported ${successCount}, failed ${errorCount}`);
        } else if (errorCount > 0) {
          setImportStatus(`Failed to import ${errorCount} font${errorCount > 1 ? 's' : ''}`);
        }

        setTimeout(() => {
          setImportStatus('');
        }, 3000);
      } finally {
        setIsImporting(false);
      }
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

    return Array.from(familyMap.entries()).map(([family, ids]) => {
      const familyFonts = ids.map((id) => fonts.find((f) => f.id === id)!).filter((f): f is CustomFont => !!f);
      const errorCount = familyFonts.filter((f) => f.error).length;
      const loadedCount = familyFonts.filter((f) => f.loaded && !f.error).length;
      return {
        name: family,
        fonts: familyFonts,
        hasError: errorCount > 0,
        errorCount,
        loadedCount,
      };
    });
  };

  const getFontVariantLabel = (font: CustomFont): string => {
    const parts: string[] = [];

    if (font.weight && font.weight !== 400) {
      const weightNames: Record<number, string> = {
        100: 'Thin',
        200: 'ExtraLight',
        300: 'Light',
        400: 'Regular',
        500: 'Medium',
        600: 'SemiBold',
        700: 'Bold',
        800: 'ExtraBold',
        900: 'Black',
      };
      parts.push(weightNames[font.weight] || `${font.weight}`);
    }

    if (font.style && font.style !== 'normal') {
      parts.push(font.style === 'italic' ? 'Italic' : 'Oblique');
    }

    if (parts.length === 0) {
      return 'Regular';
    }

    return parts.join(' ');
  };

  const availableFonts = customFonts
    .filter((font) => !font.deletedAt)
    .sort((a, b) => (b.downloadedAt || 0) - (a.downloadedAt || 0));

  const availableFamilies = getAvailableFamilies(availableFonts);

  return (
    <div className='w-full'>
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
        {availableFonts.length > 0 && !isImporting && (
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

      {importStatus && (
        <div className='alert mb-4 py-2 text-sm'>
          <span>{importStatus}</span>
        </div>
      )}

      <div className='grid grid-cols-2 gap-4'>
        <div className='card border-primary/50 hover:border-primary/75 group h-12 border-2 transition-colors'>
          <button
            className='card-body flex cursor-pointer items-center justify-center p-2 text-center'
            onClick={handleImportFont}
            disabled={isImporting}
          >
            <div className='flex items-center gap-2'>
              <div className='flex items-center justify-center'>
                {isImporting ? (
                  <span className='loading loading-spinner loading-sm text-primary'></span>
                ) : (
                  <MdAdd className='text-primary/85 group-hover:text-primary h-6 w-6' />
                )}
              </div>
              <div className='text-primary/85 group-hover:text-primary line-clamp-1 font-medium'>
                {isImporting ? _('Importing...') : _('Import Font')}
              </div>
            </div>
          </button>
        </div>

        {availableFamilies.map((family) => (
          <div
            role='none'
            key={family.name}
            className={clsx(
              'card border shadow-sm transition-all',
              'min-h-20',
              currentFontFamily === family.name
                ? 'border-primary/50 bg-primary/50'
                : `border-base-200 bg-base-200 ${isDeleteMode ? '' : 'cursor-pointer hover:border-primary/30'}`,
            )}
            onClick={!isDeleteMode ? () => handleSelectFamily(family) : undefined}
            title={family.fonts.map((f) => `${f.name}${f.error ? ` (Error: ${f.error})` : ''}`).join('\n')}
          >
            <div className='card-body flex flex-col items-start justify-center gap-1 p-2'>
              <div className='flex w-full items-center justify-between gap-1'>
                <div className='text-base-content line-clamp-1 flex-1 break-all text-xs font-medium'>
                  {family.name}
                </div>
                {family.hasError && !isDeleteMode && (
                  <MdError className='text-error h-4 w-4 flex-shrink-0' title={_('Font loading error')} />
                )}
              </div>

              {/* Font Preview Text */}
              {!family.hasError && family.loadedCount && family.loadedCount > 0 && (
                <div
                  style={{
                    fontFamily: `"${family.name}", sans-serif`,
                    fontWeight: 400,
                  }}
                  className='text-base-content/85 line-clamp-1 w-full break-all text-base'
                >
                  The quick brown fox
                </div>
              )}

              {/* Font Variants */}
              {family.fonts.length > 1 && !isDeleteMode && (
                <div className='text-base-content/60 flex flex-wrap gap-1 text-xs'>
                  {family.fonts.slice(0, 4).map((font) => (
                    <span
                      key={font.id}
                      className={clsx(
                        'rounded px-1',
                        font.error ? 'bg-error/20 text-error' : 'bg-base-300',
                      )}
                      title={font.error || undefined}
                    >
                      {getFontVariantLabel(font)}
                    </span>
                  ))}
                  {family.fonts.length > 4 && (
                    <span className='text-base-content/50'>+{family.fonts.length - 4}</span>
                  )}
                </div>
              )}

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
            <li>{_('Import multiple font variants (Regular, Italic, Bold, Bold Italic) for best results')}</li>
            <li>{_('Font variants with the same family name are grouped automatically')}</li>
            <li>{_('Custom fonts can be selected from the Font Face menu')}</li>
            {availableFamilies.some(f => f.hasError) && (
              <li className='text-error flex items-center gap-1'>
                <MdWarning className='h-3 w-3 flex-shrink-0' />
                <span>{_('Some fonts failed to load. Check the error icons for details.')}</span>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CustomFonts;
