import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FactoryTasksService } from './factory-tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto, UpdatePriorityDto, UpdateDueDateDto } from './dto/update-task.dto';
import { TaskListQueryDto } from './dto/task-list-query.dto';
import { AssignTaskDto, BlockTaskDto, CompleteTaskDto, ReopenTaskDto, CancelTaskDto } from './dto/transition.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { AddProgressDto } from './dto/add-progress.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { getRequestId } from '@recafco/observability';
import type { ApiSuccessResponse } from '@recafco/shared';
import type { AuthUser } from '../common/types/auth-user';

function meta(): { requestId?: string } {
  const id = getRequestId();
  return id !== undefined ? { requestId: id } : {};
}

@Controller('factory-tasks')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class FactoryTasksController {
  constructor(private readonly tasksService: FactoryTasksService) {}

  // summary, my, people MUST be declared before /:id to avoid route conflict

  @Get('summary')
  @Permissions('tasks.read')
  async summary(
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.tasksService.getSummary(actor);
    return { data, meta: meta(), error: null };
  }

  @Get('my')
  @Permissions('tasks.read')
  async my(
    @Query() query: TaskListQueryDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const result = await this.tasksService.findMy(query, actor);
    return { data: result, meta: meta(), error: null };
  }

  @Get('people')
  @Permissions('tasks.read')
  async people(
    @Query('search') search?: string,
  ): Promise<ApiSuccessResponse<{ id: string; displayName: string; username: string }[]>> {
    const people = await this.tasksService.listPeople(search);
    return { data: people, meta: meta(), error: null };
  }

  @Get()
  @Permissions('tasks.read')
  async list(
    @Query() query: TaskListQueryDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const result = await this.tasksService.findAll(query, actor);
    return { data: result, meta: meta(), error: null };
  }

  @Get(':id')
  @Permissions('tasks.read')
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const task = await this.tasksService.findOne(id, actor);
    return { data: task, meta: meta(), error: null };
  }

  @Post()
  @HttpCode(201)
  @Permissions('tasks.create')
  async create(
    @Body() dto: CreateTaskDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const task = await this.tasksService.create(dto, actor);
    return { data: task, meta: meta(), error: null };
  }

  @Patch(':id')
  @Permissions('tasks.update_own_draft')
  async updateDraft(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const task = await this.tasksService.updateDraft(id, dto, actor);
    return { data: task, meta: meta(), error: null };
  }

  @Patch(':id/priority')
  @Permissions('tasks.update_own_draft')
  async updatePriority(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdatePriorityDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const task = await this.tasksService.updatePriority(id, dto.priority, actor);
    return { data: task, meta: meta(), error: null };
  }

  @Patch(':id/due-date')
  @Permissions('tasks.assign')
  async updateDueDate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateDueDateDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const task = await this.tasksService.updateDueDate(id, dto.dueAt, actor);
    return { data: task, meta: meta(), error: null };
  }

  @Post(':id/open')
  @Permissions('tasks.create')
  async open(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const task = await this.tasksService.open(id, actor);
    return { data: task, meta: meta(), error: null };
  }

  @Post(':id/assign')
  @Permissions('tasks.assign')
  async assign(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AssignTaskDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const task = await this.tasksService.assign(id, dto, actor);
    return { data: task, meta: meta(), error: null };
  }

  @Post(':id/unassign')
  @Permissions('tasks.assign')
  async unassign(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const task = await this.tasksService.unassign(id, actor);
    return { data: task, meta: meta(), error: null };
  }

  @Post(':id/start')
  @Permissions('tasks.start')
  async start(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const task = await this.tasksService.start(id, actor);
    return { data: task, meta: meta(), error: null };
  }

  @Post(':id/block')
  @Permissions('tasks.block')
  async block(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: BlockTaskDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const task = await this.tasksService.block(id, dto, actor);
    return { data: task, meta: meta(), error: null };
  }

  @Post(':id/unblock')
  @Permissions('tasks.block')
  async unblock(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const task = await this.tasksService.unblock(id, actor);
    return { data: task, meta: meta(), error: null };
  }

  @Post(':id/complete')
  @Permissions('tasks.complete')
  async complete(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CompleteTaskDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const task = await this.tasksService.complete(id, dto, actor);
    return { data: task, meta: meta(), error: null };
  }

  @Post(':id/close')
  @Permissions('tasks.close')
  async close(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const task = await this.tasksService.close(id, actor);
    return { data: task, meta: meta(), error: null };
  }

  @Post(':id/reopen')
  @Permissions('tasks.manage')
  async reopen(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ReopenTaskDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const task = await this.tasksService.reopen(id, dto, actor);
    return { data: task, meta: meta(), error: null };
  }

  @Post(':id/cancel')
  @Permissions('tasks.create')
  async cancel(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CancelTaskDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const task = await this.tasksService.cancel(id, dto, actor);
    return { data: task, meta: meta(), error: null };
  }

  @Post(':id/progress')
  @HttpCode(201)
  @Permissions('tasks.update_progress')
  async addProgress(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AddProgressDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const progress = await this.tasksService.addProgress(id, dto, actor);
    return { data: progress, meta: meta(), error: null };
  }

  @Get(':id/progress')
  @Permissions('tasks.read')
  async listProgress(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const progress = await this.tasksService.listProgress(id);
    return { data: progress, meta: meta(), error: null };
  }

  @Get(':id/comments')
  @Permissions('tasks.read')
  async listComments(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const comments = await this.tasksService.listComments(id);
    return { data: comments, meta: meta(), error: null };
  }

  @Post(':id/comments')
  @HttpCode(201)
  @Permissions('tasks.comment')
  async addComment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AddCommentDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const comment = await this.tasksService.addComment(id, dto, actor);
    return { data: comment, meta: meta(), error: null };
  }

  @Get(':id/activities')
  @Permissions('tasks.read')
  async listActivities(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const activities = await this.tasksService.listActivities(id);
    return { data: activities, meta: meta(), error: null };
  }
}
