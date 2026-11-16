import { Global, Module } from '@nestjs/common';
import { CLOCK, systemClock } from './clock';

/** Provides `CLOCK` (the system clock) to every module. Tests provide a fixed one instead. */
@Global()
@Module({ providers: [{ provide: CLOCK, useValue: systemClock }], exports: [CLOCK] })
export class ClockModule {}
