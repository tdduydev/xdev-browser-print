import type { DocumentMapping, Orientation, PrintConfig, PrintFormat, PrinterProfile } from '@xdev/shared-types';
import { DOCUMENT_FORMATS, RAW_FORMATS } from '@xdev/shared-types';
import { PrintError } from './errors';

export interface ResolvedRoute {
  profile: PrinterProfile;
  mapping?: DocumentMapping;
  copies: number;
  paperSize: string;
  orientation: Orientation;
}

/** Which formats each adapter can physically carry. */
export function adapterAcceptsFormat(adapter: PrinterProfile['adapter'], format: PrintFormat): boolean {
  if (adapter === 'browser') return DOCUMENT_FORMATS.includes(format);
  return RAW_FORMATS.includes(format);
}

/**
 * Resolution order: explicit printerId → mapping for documentType → default profile of a
 * compatible category. A raw format is never silently routed to the browser adapter (and
 * vice versa), because the output would be garbage.
 */
export function resolveRoute(
  config: PrintConfig,
  req: { documentType: string; format: PrintFormat; printerId?: string; copies?: number },
): ResolvedRoute {
  const mapping = config.mappings[req.documentType];
  let profile: PrinterProfile | undefined;
  if (req.printerId) {
    profile = config.profiles.find((p) => p.id === req.printerId);
    if (!profile) throw new PrintError('PROFILE_NOT_FOUND', 'Printer profile does not exist', { printerId: req.printerId });
  } else if (mapping) {
    profile = config.profiles.find((p) => p.id === mapping.printerId);
    if (!profile) throw new PrintError('PROFILE_NOT_FOUND', 'Mapped printer profile no longer exists', { printerId: mapping.printerId });
  } else {
    profile = config.profiles.find((p) => p.isDefault && adapterAcceptsFormat(p.adapter, req.format));
    if (!profile) {
      throw new PrintError('MAPPING_NOT_FOUND', 'No mapping for this document type and no compatible default printer', {
        documentType: req.documentType,
      });
    }
  }
  if (!adapterAcceptsFormat(profile.adapter, req.format)) {
    throw new PrintError('UNSUPPORTED_FORMAT', `Printer "${profile.id}" (${profile.adapter}) cannot print ${req.format}`, {
      printerId: profile.id,
      adapter: profile.adapter,
      format: req.format,
    });
  }
  const useMapping = mapping && mapping.printerId === profile.id ? mapping : undefined;
  return {
    profile,
    mapping: useMapping,
    copies: req.copies ?? useMapping?.copies ?? profile.copies,
    paperSize: useMapping?.paperSize ?? profile.paperSize,
    orientation: useMapping?.orientation ?? profile.orientation,
  };
}
