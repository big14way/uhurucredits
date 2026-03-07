/**
 * Uhuru Credit - CRE Credit Scoring Workflow
 *
 * Privacy-preserving credit scoring using Chainlink CRE (TEE).
 * Fetches African banking data from Mono.co, computes a credit score,
 * and publishes the result on-chain via CRE consensus.
 *
 * Scoring Algorithm (0-1000):
 * - Base Score: 300 points
 * - Balance Health: up to 200 points (avg balance / avg monthly income)
 * - Transaction Frequency: up to 150 points (30+ tx/month = max)
 * - Income Regularity: up to 200 points (NGN thresholds)
 * - World ID Verification: 100 points
 * - Reclaim zkTLS (M-Pesa): 100 points
 * - Penalties: negative balance (-100 max), existing loans (-50)
 */

import {
	bytesToHex,
	ConsensusAggregationByFields,
	type CronPayload,
	cre,
	getNetwork,
	HTTPCapability,
	type HTTPPayload,
	type HTTPSendRequester,
	hexToBase64,
	identical,
	median,
	Runner,
	type Runtime,
	TxStatus,
} from '@chainlink/cre-sdk'
import { encodeAbiParameters, type Hex } from 'viem'
import { z } from 'zod'

// ============================================================================
// Config & Types
// ============================================================================

const configSchema = z.object({
	schedule: z.string(),
	monoApiUrl: z.string(),
	creConsumerAddress: z.string(),
	chainName: z.string(),
	gasLimit: z.string(),
})

type Config = z.infer<typeof configSchema>

interface MonoTransaction {
	amount: number
	type: 'debit' | 'credit'
	date: string
	balance: number
	narration: string
}

interface ScoringParams {
	avgMonthlyIncome: number
	transactionFrequency: number
	avgBalance: number
	negativeBalanceDays: number
	worldIdVerified: boolean
	reclaimVerified: boolean
	hasExistingLoans: boolean
}

interface CreditScoreResult {
	score: number
	worldIdVerified: boolean
	reclaimVerified: boolean
}

// ============================================================================
// Scoring Algorithm
// ============================================================================

function computeCreditScore(params: ScoringParams): number {
	let score = 300 // base score

	// Balance health: avgBalance / avgMonthlyIncome ratio (max 200 points)
	const balanceRatio =
		params.avgMonthlyIncome > 0
			? params.avgBalance / params.avgMonthlyIncome
			: 0
	score += Math.min(200, Math.floor(balanceRatio * 200))

	// Transaction frequency: consistent activity (max 150 points)
	// 30+ tx/month = full points, scale linearly
	score += Math.min(
		150,
		Math.floor((params.transactionFrequency / 30) * 150),
	)

	// Income regularity (max 200 points) - NGN thresholds
	if (params.avgMonthlyIncome > 50000) score += 200
	else if (params.avgMonthlyIncome > 20000) score += 150
	else if (params.avgMonthlyIncome > 5000) score += 100
	else if (params.avgMonthlyIncome > 1000) score += 50

	// Deduct for negative balance days (up to -100)
	score -= Math.min(100, params.negativeBalanceDays * 3)

	// Identity bonuses
	if (params.worldIdVerified) score += 100
	if (params.reclaimVerified) score += 100

	// Existing loans penalty
	if (params.hasExistingLoans) score -= 50

	return Math.max(0, Math.min(1000, score))
}

function extractScoringParams(
	transactions: MonoTransaction[],
	worldIdVerified: boolean,
	reclaimVerified: boolean,
): ScoringParams {
	const now = new Date()
	const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

	const recent = transactions.filter(
		(tx) => new Date(tx.date) >= ninetyDaysAgo,
	)

	const credits = recent.filter((tx) => tx.type === 'credit')
	const totalIncome = credits.reduce((sum, tx) => sum + tx.amount, 0)
	const avgMonthlyIncome = totalIncome / 3 // 90 days = 3 months

	const avgBalance =
		recent.length > 0
			? recent.reduce((sum, tx) => sum + (tx.balance || 0), 0) /
				recent.length
			: 0

	const negativeBalanceDays = recent.filter(
		(tx) => (tx.balance || 0) < 0,
	).length

	return {
		avgMonthlyIncome,
		transactionFrequency: recent.length / 3,
		avgBalance,
		negativeBalanceDays,
		worldIdVerified,
		reclaimVerified,
		hasExistingLoans: false,
	}
}

// ============================================================================
// Demo Transaction Data
// Used when Mono API is unavailable (no key, sandbox, etc.)
// Realistic Lagos salary worker: 150k NGN/month + freelance income
// Produces score ~850 with WorldID, ~950 with WorldID + Reclaim
// ============================================================================

function generateDemoTransactions(): MonoTransaction[] {
	const msPerDay = 86_400_000
	const now = Date.now()
	const date = (daysAgo: number) =>
		new Date(now - daysAgo * msPerDay).toISOString().split('T')[0]

	type TxSpec = {
		daysAgo: number
		amount: number
		type: 'credit' | 'debit'
		narration: string
	}

	// One month of transactions (offset shifts the whole block into the past)
	const monthSpec = (offset: number): TxSpec[] => [
		{ daysAgo: offset + 1,  amount: 150_000, type: 'credit', narration: 'SALARY - EMPLOYER NGN' },
		{ daysAgo: offset + 2,  amount: 50_000,  type: 'debit',  narration: 'RENT PAYMENT' },
		{ daysAgo: offset + 3,  amount: 5_500,   type: 'debit',  narration: 'SHOPRITE SUPERMARKET' },
		{ daysAgo: offset + 4,  amount: 3_000,   type: 'debit',  narration: 'TOTAL FILLING STATION' },
		{ daysAgo: offset + 5,  amount: 1_800,   type: 'debit',  narration: 'UBER RIDES' },
		{ daysAgo: offset + 6,  amount: 1_500,   type: 'debit',  narration: 'MTN AIRTIME' },
		{ daysAgo: offset + 7,  amount: 7_200,   type: 'debit',  narration: 'TANTALIZERS RESTAURANT' },
		{ daysAgo: offset + 8,  amount: 20_000,  type: 'credit', narration: 'FREELANCE - USD TRANSFER' },
		{ daysAgo: offset + 9,  amount: 4_500,   type: 'debit',  narration: 'DSTV SUBSCRIPTION' },
		{ daysAgo: offset + 10, amount: 2_800,   type: 'debit',  narration: 'PHARMACY/CHEMIST' },
		{ daysAgo: offset + 11, amount: 6_000,   type: 'debit',  narration: 'EKEDC ELECTRICITY' },
		{ daysAgo: offset + 12, amount: 2_500,   type: 'debit',  narration: 'UBER RIDES' },
		{ daysAgo: offset + 13, amount: 8_000,   type: 'debit',  narration: 'GROCERY STORE' },
		{ daysAgo: offset + 14, amount: 1_200,   type: 'debit',  narration: 'WATER BILL' },
		{ daysAgo: offset + 15, amount: 10_000,  type: 'credit', narration: 'PEER TRANSFER RECEIVED' },
		{ daysAgo: offset + 16, amount: 3_500,   type: 'debit',  narration: 'FUEL' },
		{ daysAgo: offset + 17, amount: 4_000,   type: 'debit',  narration: 'JUMIA ONLINE SHOPPING' },
		{ daysAgo: offset + 18, amount: 1_800,   type: 'debit',  narration: 'BARBER / SALON' },
		{ daysAgo: offset + 19, amount: 2_500,   type: 'debit',  narration: 'LUNCH - OFFICE CANTEEN' },
		{ daysAgo: offset + 20, amount: 1_500,   type: 'debit',  narration: 'AIRTIME TOPUP' },
		{ daysAgo: offset + 21, amount: 9_000,   type: 'debit',  narration: 'WEEKLY GROCERIES' },
		{ daysAgo: offset + 22, amount: 1_500,   type: 'debit',  narration: 'TRANSPORT' },
		{ daysAgo: offset + 23, amount: 3_000,   type: 'debit',  narration: 'DINNER - RESTAURANT' },
		{ daysAgo: offset + 24, amount: 2_000,   type: 'debit',  narration: 'PHARMACY' },
		{ daysAgo: offset + 25, amount: 5_000,   type: 'debit',  narration: 'FUEL' },
		{ daysAgo: offset + 26, amount: 3_500,   type: 'debit',  narration: 'LAUNDRY' },
		{ daysAgo: offset + 27, amount: 6_000,   type: 'debit',  narration: 'GROCERY STORE' },
		{ daysAgo: offset + 28, amount: 2_200,   type: 'debit',  narration: 'TRANSPORT' },
		{ daysAgo: offset + 29, amount: 4_000,   type: 'debit',  narration: 'NETFLIX / STREAMING' },
		{ daysAgo: offset + 30, amount: 7_500,   type: 'debit',  narration: 'WEEKEND OUTING' },
	]

	// Three months of specs (month 1 = most recent)
	const specs: TxSpec[] = [
		...monthSpec(0),
		...monthSpec(30),
		...monthSpec(60),
	]

	// Build transactions with running balance, then filter to 90-day window
	let balance = 180_000
	return specs
		.map((t) => {
			balance += t.type === 'credit' ? t.amount : -t.amount
			return { amount: t.amount, type: t.type, date: date(t.daysAgo), balance, narration: t.narration }
		})
		.filter((t) => new Date(t.date).getTime() >= now - 90 * msPerDay)
}

// ============================================================================
// CRE HTTP Data Fetcher (runs inside TEE with DON consensus)
// ============================================================================

const fetchMonoData = (
	sendRequester: HTTPSendRequester,
	config: Config,
): CreditScoreResult => {
	// In production, the Mono account ID and verification flags come from
	// workflow secrets or trigger payload. For simulation, use defaults.
	const monoAccountId = 'test_account'
	const worldIdVerified = true
	const reclaimVerified = false

	// Fetch bank transactions from Mono.co API
	const response = sendRequester
		.sendRequest({
			method: 'GET',
			url: `${config.monoApiUrl}/v2/accounts/${monoAccountId}/transactions?limit=100&period=last90days`,
		})
		.result()

	let transactions: MonoTransaction[] = []

	if (response.statusCode === 200) {
		try {
			const responseText = Buffer.from(response.body).toString('utf-8')
			const parsed = JSON.parse(responseText)
			transactions = parsed?.data?.transactions || []
		} catch {
			// parsing failed — fall through to demo data
		}
	}

	// Fall back to demo data when Mono API is unavailable or returns no transactions
	if (transactions.length === 0) {
		transactions = generateDemoTransactions()
	}

	// Compute credit score from transaction data
	const scoringParams = extractScoringParams(
		transactions,
		worldIdVerified,
		reclaimVerified,
	)
	const score = computeCreditScore(scoringParams)

	return { score, worldIdVerified, reclaimVerified }
}

// ============================================================================
// ABI Encoding for On-Chain Report
// ============================================================================

const safeJsonStringify = (obj: any): string =>
	JSON.stringify(
		obj,
		(_, value) => (typeof value === 'bigint' ? value.toString() : value),
		2,
	)

/**
 * Encode the credit report for the CREConsumer contract's onReport(bytes) function.
 * Format: (address wallet, uint16 score, bool worldIdVerified, bool reclaimVerified)
 */
const encodeCreditReport = (
	wallet: string,
	result: CreditScoreResult,
): Hex => {
	return encodeAbiParameters(
		[
			{ name: 'wallet', type: 'address' },
			{ name: 'score', type: 'uint16' },
			{ name: 'worldIdVerified', type: 'bool' },
			{ name: 'reclaimVerified', type: 'bool' },
		],
		[
			wallet as `0x${string}`,
			result.score,
			result.worldIdVerified,
			result.reclaimVerified,
		],
	)
}

const hexToBytes32RightPadded = (input: string): Hex => {
	let hex = input.toLowerCase()
	if (hex.startsWith('0x')) hex = hex.slice(2)
	if (hex.length % 2 !== 0) hex = '0' + hex

	const byteLen = hex.length / 2
	if (byteLen > 32) {
		throw new Error(
			`hex string decodes to ${byteLen} bytes, which exceeds 32 bytes`,
		)
	}

	const padded = hex.padEnd(64, '0')
	return ('0x' + padded) as Hex
}

// ============================================================================
// On-Chain Report Writing
// ============================================================================

const writeCreditScoreOnChain = (
	runtime: Runtime<Config>,
	wallet: string,
	result: CreditScoreResult,
): string => {
	const network = getNetwork({
		chainFamily: 'evm',
		chainSelectorName: runtime.config.chainName,
		isTestnet: true,
	})

	if (!network) {
		throw new Error(
			`Network not found for chain: ${runtime.config.chainName}`,
		)
	}

	const evmClient = new cre.capabilities.EVMClient(
		network.chainSelector.selector,
	)

	runtime.log(
		`Writing credit score on-chain: wallet=${wallet}, score=${result.score}`,
	)

	// Encode the credit report
	const reportData = encodeCreditReport(wallet, result)

	// Generate signed report via CRE consensus
	const reportResponse = runtime
		.report({
			encodedPayload: hexToBase64(reportData),
			encoderName: 'evm',
			signingAlgo: 'ecdsa',
			hashingAlgo: 'keccak256',
		})
		.result()

	// Write the report to the CREConsumer contract on-chain
	const resp = evmClient
		.writeReport(runtime, {
			receiver: runtime.config.creConsumerAddress,
			report: reportResponse,
			gasConfig: {
				gasLimit: runtime.config.gasLimit,
			},
		})
		.result()

	const txStatus = resp.txStatus

	if (txStatus !== TxStatus.SUCCESS) {
		throw new Error(
			`Failed to write credit report: ${resp.errorMessage || txStatus}`,
		)
	}

	const txHash = resp.txHash || new Uint8Array(32)
	runtime.log(
		`Credit score written on-chain: txHash=${bytesToHex(txHash)}`,
	)

	return txHash.toString()
}

// ============================================================================
// Main CRE Workflow
// ============================================================================

const doCreditScoring = (runtime: Runtime<Config>): string => {
	runtime.log(
		`Starting Uhuru Credit scoring workflow - Mono API: ${runtime.config.monoApiUrl}`,
	)

	// Step 1: Fetch Mono bank data with DON consensus
	const httpCapability = new cre.capabilities.HTTPClient()
	const scoreResult = httpCapability
		.sendRequest(
			runtime,
			fetchMonoData,
			ConsensusAggregationByFields<CreditScoreResult>({
				score: median,
				worldIdVerified: identical,
				reclaimVerified: identical,
			}),
		)(runtime.config)
		.result()

	runtime.log(`Credit score computed: ${safeJsonStringify(scoreResult)}`)

	// Step 2: Write score on-chain via CREConsumer
	// In production, wallet address comes from the trigger payload
	const wallet = '0x0000000000000000000000000000000000000001'
	writeCreditScoreOnChain(runtime, wallet, scoreResult)

	return `Score: ${scoreResult.score}`
}

const onCronTrigger = (
	runtime: Runtime<Config>,
	payload: CronPayload,
): string => {
	if (!payload.scheduledExecutionTime) {
		throw new Error('Scheduled execution time is required')
	}

	runtime.log('Running Uhuru Credit scoring CronTrigger')

	return doCreditScoring(runtime)
}

// ============================================================================
// HTTP Trigger — per-user on-demand scoring
// Payload: { wallet, worldIdVerified, reclaimVerified, monoAccountId }
// Simulate: cre workflow simulate . --http-payload '{"wallet":"0x...","worldIdVerified":true}' --non-interactive --trigger-index 1
// ============================================================================

const onHttpTrigger = (
	runtime: Runtime<Config>,
	payload: HTTPPayload,
): string => {
	let wallet = '0x0000000000000000000000000000000000000001'
	let worldIdVerified = false
	let reclaimVerified = false
	let monoAccountId = 'test_account'

	try {
		const body = JSON.parse(
			Buffer.from(payload.input).toString('utf-8'),
		)
		if (body.wallet) wallet = body.wallet
		if (body.worldIdVerified !== undefined)
			worldIdVerified = Boolean(body.worldIdVerified)
		if (body.reclaimVerified !== undefined)
			reclaimVerified = Boolean(body.reclaimVerified)
		if (body.monoAccountId) monoAccountId = body.monoAccountId
	} catch {
		// use defaults
	}

	runtime.log(
		`HTTP trigger: scoring wallet=${wallet} worldId=${worldIdVerified} reclaim=${reclaimVerified}`,
	)

	// Build a per-user Mono fetcher via closure
	const fetchMonoDataForUser = (
		sendRequester: HTTPSendRequester,
		config: Config,
	): CreditScoreResult => {
		const response = sendRequester
			.sendRequest({
				method: 'GET',
				url: `${config.monoApiUrl}/v2/accounts/${monoAccountId}/transactions?limit=100&period=last90days`,
			})
			.result()

		let transactions: MonoTransaction[] = []
		if (response.statusCode === 200) {
			try {
				const text = Buffer.from(response.body).toString('utf-8')
				transactions = JSON.parse(text)?.data?.transactions || []
			} catch {
				// parsing failed — fall through to demo data
			}
		}

		// Fall back to demo data when Mono API is unavailable or returns no transactions
		if (transactions.length === 0) {
			transactions = generateDemoTransactions()
		}

		const params = extractScoringParams(
			transactions,
			worldIdVerified,
			reclaimVerified,
		)
		const score = computeCreditScore(params)
		return { score, worldIdVerified, reclaimVerified }
	}

	const httpCapability = new cre.capabilities.HTTPClient()
	const scoreResult = httpCapability
		.sendRequest(
			runtime,
			fetchMonoDataForUser,
			ConsensusAggregationByFields<CreditScoreResult>({
				score: median,
				worldIdVerified: identical,
				reclaimVerified: identical,
			}),
		)(runtime.config)
		.result()

	// Emit parseable log line for backend to capture
	runtime.log(
		`UHURU_CRE_SCORE:${JSON.stringify({
			wallet,
			score: scoreResult.score,
			worldIdVerified: scoreResult.worldIdVerified,
			reclaimVerified: scoreResult.reclaimVerified,
		})}`,
	)

	return `Score: ${scoreResult.score}`
}

const initWorkflow = (config: Config) => {
	const cronTrigger = new cre.capabilities.CronCapability()
	const httpTrigger = new HTTPCapability()
	return [
		cre.handler(
			cronTrigger.trigger({
				schedule: config.schedule,
			}),
			onCronTrigger,
		),
		// trigger-index 1: HTTP trigger for per-user on-demand scoring
		cre.handler(
			httpTrigger.trigger({ authorizedKeys: [] }),
			onHttpTrigger,
		),
	]
}

export async function main() {
	const runner = await Runner.newRunner<Config>({ configSchema })
	await runner.run(initWorkflow)
}

main()
