import { apiRequest } from './apiClient';

export const deleteAccount = async () => {
  return apiRequest<{ success: boolean }>('/me/account/delete', {
    method: 'POST',
  });
};

export default {
  deleteAccount,
};
