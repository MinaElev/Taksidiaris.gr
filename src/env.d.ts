/// <reference path="../.astro/types.d.ts" />

import type { AgencySession } from '@lib/agency-auth';

declare namespace App {
  interface Locals {
    agency?: AgencySession;
  }
}
