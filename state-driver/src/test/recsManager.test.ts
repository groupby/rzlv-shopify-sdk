import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initRecsManager, setupRecommendations, recsInputStore, recsOutputStore } from '../recsManager';
import { updateRecsInputStore } from '../recsInputStore';
import { updateRecsOutputStore } from '../recsOutputStore';
import { sdkConfig } from '../debugLogger';

vi.mock('@rzlv/public-api-sdk', () => {
	enum AppEnv {
		Production = 'production',
		ProxyDev = 'proxydev',
		ProxyProd = 'proxyprod',
	}
	type RecsProduct = { id: string; [key: string]: unknown };
	type RequestRecsResponse = {
		products: RecsProduct[];
		metadata: { modelName: string; totalCount: number };
		rawResponse: unknown;
	};
	const requestRecommendations = vi.fn(async (_tenant: string, _env: AppEnv, options: { name?: string }) => {
		const response: RequestRecsResponse = {
			products: Array.from({ length: 7 }).map((_, i) => ({ id: `p${i + 1}` })),
			metadata: { modelName: options?.name ?? 'model', totalCount: 7 },
			rawResponse: { ok: true },
		};
		return response;
	});
	return {
		AppEnv,
		requestRecommendations,
		RecsFilter: {} as unknown,
		RecsRequestProduct: {} as unknown,
		RecsManagerConfig: {} as unknown,
		RequestRecsResponse: {} as unknown,
	};
});

let AppEnvRef: any;
let requestRecommendationsRef: any;

function resetStores() {
	updateRecsInputStore(() => ({
		name: '',
		fields: ['*'],
		collection: '',
		pageSize: 10,
		currentPage: 0,
		limit: undefined,
		productID: undefined,
		products: undefined,
		visitorId: undefined,
		loginId: undefined,
		filters: undefined,
		rawFilter: undefined,
		placement: undefined,
		eventType: undefined,
		area: undefined,
		debug: undefined,
		strictFiltering: undefined,
		hasRequested: false,
	}));
	updateRecsOutputStore(() => ({
		products: [],
		allProducts: [],
		pagination: { currentPage: 0, pageSize: 10, totalPages: 0, totalRecords: 0 },
		metadata: { modelName: '', totalCount: 0 },
		loading: false,
		error: null,
		rawResponse: undefined,
	}));
}

describe('recsManager', () => {
	beforeEach(async () => {
		resetStores();
		const mod = await import('@rzlv/public-api-sdk');
		AppEnvRef = mod.AppEnv;
		requestRecommendationsRef = mod.requestRecommendations;
		(requestRecommendationsRef as any)?.mockClear?.();
		(initRecsManager as any).initialized = undefined;
		sdkConfig.debug = false;
	});

	it('initRecsManager initializes once and is idempotent', async () => {
		initRecsManager({
			shopTenant: 'tenant',
			appEnv: AppEnvRef.Production,
			name: 'model',
			collection: 'products',
			pageSize: 5,
			debug: true,
		});
		expect((initRecsManager as any).initialized).toBe(true);
		expect(sdkConfig.debug).toBe(true);

		initRecsManager({
			shopTenant: 'tenant2',
			appEnv: AppEnvRef.Production,
			name: 'model2',
			collection: 'products',
			pageSize: 10,
			debug: false,
		});
		expect((initRecsManager as any).initialized).toBe(true);
	});

	it('setupRecommendations updates input store and triggers request through effect', async () => {
		initRecsManager({
			shopTenant: 'tenant',
			appEnv: AppEnvRef.Production,
			name: 'model',
			collection: 'products',
			pageSize: 5,
		});

		(requestRecommendationsRef as any)?.mockClear?.();

		expect(recsInputStore.getState().hasRequested).toBe(false);

		setupRecommendations({
			name: 'model',
			collection: 'products',
			pageSize: 3,
			currentPage: 1,
		});

		expect(recsInputStore.getState().hasRequested).toBe(true);

		await Promise.resolve();
		await Promise.resolve();

		expect(requestRecommendationsRef).toHaveBeenCalledTimes(2);
		expect(requestRecommendationsRef).toHaveBeenCalledWith(
			'tenant',
			AppEnvRef.Production,
			expect.objectContaining({
				name: 'model',
				collection: 'products',
				pageSize: 3,
				currentPage: 1,
			})
		);

		const out = recsOutputStore.getState();
		expect(out.loading).toBe(false);
		expect(out.error).toBeNull();
		expect(out.products.map(p => p.id)).toEqual(['p4', 'p5', 'p6']);
		expect(out.allProducts).toHaveLength(7);
		expect(out.pagination).toEqual({ currentPage: 1, pageSize: 3, totalPages: Math.ceil(7 / 3), totalRecords: 7 });

		expect(recsInputStore.getState().hasRequested).toBe(false);
	});

	it('does not trigger when name is empty (filter guard)', async () => {
		initRecsManager({
			shopTenant: 'tenant',
			appEnv: AppEnvRef.Production,
			name: 'model',
			collection: 'products',
			pageSize: 5,
		});

		setupRecommendations({ name: '', collection: 'products', pageSize: 5, currentPage: 0 });
		await Promise.resolve();
		expect(requestRecommendationsRef).not.toHaveBeenCalled();

		const out = recsOutputStore.getState();
		expect(out.products).toEqual([]);
		expect(out.loading).toBe(false);
	});
});
