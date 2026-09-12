import type { ReactNode } from 'react';
import { RuntimeContext, useRuntimeController } from './runtime';
import type { DocxodusRuntimeOptions } from './runtime';

export function DocxodusProvider({ children, ...options }: DocxodusRuntimeOptions & { children: ReactNode }) {
  const runtime = useRuntimeController(options);
  return <RuntimeContext.Provider value={runtime}>{children}</RuntimeContext.Provider>;
}
