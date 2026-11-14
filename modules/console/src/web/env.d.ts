// @ts-nocheck
// The data a Fastify route hands to a template (ADR 0132): the template reads it and computes nothing.
declare namespace App {
  interface Locals {
    page: unknown;
    /** The HTTP status of the page and its text, which the template sets on Astro.response. */
    status: number;
    statusText: string;
  }
}
