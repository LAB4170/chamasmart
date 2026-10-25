import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// Older tests were written against the jest API.
globalThis.jest = vi;
