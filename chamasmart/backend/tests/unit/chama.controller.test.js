import { jest } from '@jest/globals';
import {
  mockRequest,
  mockResponse,
  mockNext,
  createTestChama,
  createTestMember,
} from '../utils/test-utils.js';

// Import the controller after mocking dependencies
import * as chamaController from '../../controllers/chama.controller.js';
import * as chamaService from '../../services/chama.service.js';

// Mock the chama service
jest.mock('../../services/chama.service.js', () => ({
  createChama: jest.fn(),
  getChamaById: jest.fn(),
  updateChama: jest.fn(),
  deleteChama: jest.fn(),
  addMember: jest.fn(),
  removeMember: jest.fn(),
  getChamaMembers: jest.fn(),
}));

describe('Chama Controller', () => {
  describe('createChama', () => {
    it('should create a new chama successfully', async () => {
      const testChama = createTestChama();
      const req = mockRequest(
        {
          name: 'Test Chama',
          description: 'A test chama group',
          meeting_schedule: 'First Monday of the month',
          contribution_amount: 1000,
        },
        {},
        {},
        { id: 1 },
      ); // Authenticated user

      const res = mockResponse();

      // Mock the service response
      chamaService.createChama.mockResolvedValue(testChama);

      await chamaController.createChama(req, res, mockNext);

      expect(chamaService.createChama).toHaveBeenCalledWith({
        name: 'Test Chama',
        description: 'A test chama group',
        meeting_schedule: 'First Monday of the month',
        contribution_amount: 1000,
        created_by: 1,
      });

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: testChama,
      });
    });
  });

  describe('getChama', () => {
    it('should return a chama by ID', async () => {
      const testChama = createTestChama();
      const req = mockRequest({}, { id: '1' });
      const res = mockResponse();

      // Mock the service response
      chamaService.getChamaById.mockResolvedValue(testChama);

      await chamaController.getChama(req, res, mockNext);

      expect(chamaService.getChamaById).toHaveBeenCalledWith('1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: testChama,
      });
    });
  });

  describe('addMember', () => {
    it('should add a member to a chama', async () => {
      const testMember = createTestMember();
      const req = mockRequest(
        { role: 'member' },
        { id: '1', userId: '2' },
        {},
        { id: 1 }, // Authenticated user (chama admin)
      );

      const res = mockResponse();

      // Mock the service response
      chamaService.addMember.mockResolvedValue(testMember);

      await chamaController.addMember(req, res, mockNext);

      expect(chamaService.addMember).toHaveBeenCalledWith(
        '1',
        '2',
        'member',
        1,
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: testMember,
      });
    });
  });

  // Add more test cases for other chama controller methods
});
