import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DepartmentsController } from './departments/departments.controller';
import { DepartmentsService } from './departments/departments.service';
import { PlantsController } from './plants/plants.controller';
import { PlantsService } from './plants/plants.service';
import { LocationsController } from './locations/locations.controller';
import { LocationsService } from './locations/locations.service';

@Module({
  imports: [DatabaseModule],
  controllers: [DepartmentsController, PlantsController, LocationsController],
  providers: [DepartmentsService, PlantsService, LocationsService],
  exports: [DepartmentsService, PlantsService, LocationsService],
})
export class OrganizationsModule {}
