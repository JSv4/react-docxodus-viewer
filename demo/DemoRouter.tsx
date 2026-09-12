import { lazy } from 'react';

// Load each example's application styles only when that example is requested.
export default lazy(() => new URLSearchParams(window.location.search).get('example') === 'modules'
  ? import('./components/ModuleExamples')
  : import('./App'));
