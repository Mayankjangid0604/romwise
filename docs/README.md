# Roamwise Documentation

This directory contains current and historical documentation for the Roamwise project.

## Directory Structure

- `/architecture/`: Current architecture decisions and feature matrices (e.g. Collaboration Matrix).
- `/deployment/`: Checklists and handoffs for deployment, infrastructure, and CI.
- `/data/`: Data platform and importer documentation.
- `/audits/`: Formal reports, benchmarks, and audits.
  - `/audits/current/`: Audits that are actively useful sources of truth.
  - `/audits/archive/`: Historical audits that have been superseded but remain useful records.

## Key Documents

- [Deployment Checklist](../README.md) - Main repository readme.
- [Collaboration Matrix](architecture/COLLABORATION-MATRIX.md) - Permissions and roles for trips.
- [India Data Platform Audit](audits/current/INDIA-DATA-PLATFORM-AUDIT.md) - Details on destination generation and architecture.
- [Prisma Migration Recovery Audit](audits/current/PRISMA-MIGRATION-RECOVERY-AUDIT.md) - Explanation of the emergency PRISMA migration drift recovery.
- [CI/Vercel Root Cause](audits/current/CI-VERCEL-ROOT-CAUSE.md) - Explanation of CI and Vercel failures.
