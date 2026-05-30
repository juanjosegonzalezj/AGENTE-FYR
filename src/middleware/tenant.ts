import type { Request, Response, NextFunction } from 'express';
import { getComplexById, getComplexBySlug } from '../db/queries/complexes.js';
import logger from '../utils/logger.js';

// Resolves which sports complex this request belongs to.
// Priority: X-Tenant-ID header > X-Tenant-Slug header > query param
export async function tenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const tenantId = req.headers['x-tenant-id'] as string | undefined;
  const tenantSlug = req.headers['x-tenant-slug'] as string | undefined;
  const querySlug = req.query['complex'] as string | undefined;

  let complex = null;

  if (tenantId) {
    complex = await getComplexById(tenantId);
  } else if (tenantSlug) {
    complex = await getComplexBySlug(tenantSlug);
  } else if (querySlug) {
    complex = await getComplexBySlug(querySlug);
  }

  if (!complex) {
    res.status(400).json({ success: false, error: 'Sports complex not found. Provide X-Tenant-ID or X-Tenant-Slug header.' });
    return;
  }

  req.tenantId = complex.id;
  req.complex = complex;
  logger.debug(`Tenant resolved: ${complex.name} (${complex.id})`);
  next();
}

// Same as above but doesn't fail — used for optional tenant resolution
export async function optionalTenantMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const tenantId = req.headers['x-tenant-id'] as string | undefined;
  const tenantSlug = req.headers['x-tenant-slug'] as string | undefined;

  if (tenantId) {
    req.complex = (await getComplexById(tenantId)) ?? undefined;
    if (req.complex) req.tenantId = req.complex.id;
  } else if (tenantSlug) {
    req.complex = (await getComplexBySlug(tenantSlug)) ?? undefined;
    if (req.complex) req.tenantId = req.complex.id;
  }

  next();
}
