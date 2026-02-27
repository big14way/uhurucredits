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
	type HTTPSendRequester,
	hexToBase64,
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
			// If parsing fails, proceed with empty transactions (base score only)
		}
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
				worldIdVerified: median,
				reclaimVerified: median,
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

const initWorkflow = (config: Config) => {
	const cronTrigger = new cre.capabilities.CronCapability()
	return [
		cre.handler(
			cronTrigger.trigger({
				schedule: config.schedule,
			}),
			onCronTrigger,
		),
	]
}

export async function main() {
	const runner = await Runner.newRunner<Config>({ configSchema })
	await runner.run(initWorkflow)
}

main()
