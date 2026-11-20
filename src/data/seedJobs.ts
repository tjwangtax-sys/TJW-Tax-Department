/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TaxJob } from '../types/tax';

export function buildSeedTaxJobs(_ownerUid: string): Omit<TaxJob, 'createdAt' | 'updatedAt'>[] {
  return [];
}
