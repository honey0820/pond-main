import { AppState, AppDispatch } from '../index'
import { useSelector, useDispatch } from 'react-redux'
import * as Sentry from '@sentry/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAsyncMemo } from 'use-async-memo'
import {
  typeInput,
  Field,
  BridgeTransactionStatus,
  selectBridgeDirection,
  selectCurrency,
  setRecipient,
  addBridgeTransaction,
  setCurrentBridgeTransaction,
  finalizeBridgeTransaction
} from './actions'
import { Currency, CurrencyAmount, ChainId, Token } from '@fuseio/fuse-swap-sdk'
import { useCurrencyBalances } from '../wallet/hooks'
import { useActiveWeb3React, useChain } from '../../hooks'
import { tryParseAmount } from '../swap/hooks'
import { DEFAULT_CONFIRMATIONS_LIMIT } from '../../constants/bridge'
import { useCurrency } from '../../hooks/Tokens'
import { getMinMaxPerTxn } from './limits'
import {
  getBridgeType,
  getMultiBridgeFee,
  getNativeAMBBridgeFee,
  calculateMultiBridgeFee,
  calculateNativeAMBBridgeFee,
  getBscFuseInverseLibrary,
  isAddress,
  calculateBnbNativeAMBBridgeFee,
  getBnbNativeAMBBridgeFee,
  getUnclaimedAmbTransaction,
  getUnclaimedNativeTransaction,
  getAmbBridgeTransactionStatus,
  getNativeBridgeTransactionStatus
} from '../../utils'
import useParsedQueryString from '../../hooks/useParsedQueryString'
import {
  FUSE_ERC20_TO_ERC677_BRIDGE_HOME_ADDRESS,
  BINANCE_CHAIN_ID,
  BINANCE_ERC20_TO_ERC677_HOME_BRIDGE_ADDRESS
} from '../../constants'
import { BridgeTransaction } from './reducer'

export enum BridgeType {
  ETH_FUSE_NATIVE = 'ETH_FUSE_NATIVE',
  ETH_FUSE_ERC677_TO_ERC677 = 'ETH_FUSE_ERC677_TO_ERC677',
  ETH_FUSE_ERC20_TO_ERC677 = 'ETH_FUSE_ERC20_TO_ERC677',
  BSC_FUSE_ERC20_TO_ERC677 = 'BSC_FUSE_ERC20_TO_ERC677',
  BSC_FUSE_NATIVE = 'BSC_FUSE_NATIVE',
  BSC_FUSE_BNB_NATIVE = 'BSC_FUSE_BNB_NATIVE'
}

export enum BridgeDirection {
  ETH_TO_FUSE = 'ETH_TO_FUSE',
  FUSE_TO_ETH = 'FUSE_TO_ETH',
  BSC_TO_FUSE = 'BSC_TO_FUSE',
  FUSE_TO_BSC = 'FUSE_TO_BSC'
}

export function useBridgeState(): AppState['bridge'] {
  return useSelector<AppState, AppState['bridge']>(state => state.bridge)
}

export function useDerivedBridgeInfo(
  bridgeDirection?: BridgeDirection
): {
  currencies: { [field in Field]?: Currency }
  currencyBalances: { [field in Field]?: CurrencyAmount }
  parsedAmounts: { [field in Field]?: CurrencyAmount }
  inputError?: string
  bridgeTransactionStatus: BridgeTransactionStatus
  confirmations: number
  bridgeFee?: string
  inputCurrencyId?: string
} {
  const { account, chainId, library } = useActiveWeb3React()

  const { isHome } = useChain()

  const {
    independentField,
    typedValue,
    bridgeTransactionStatus,
    confirmations,
    [Field.INPUT]: { currencyId: inputCurrencyId },
    recipient
  } = useBridgeState()

  const inputCurrency = useCurrency(inputCurrencyId, 'Bridge')

  // we fetch currencyId from Token for consistency
  const currencyId = useMemo(() => {
    return inputCurrency instanceof Token ? inputCurrency.address : inputCurrency?.symbol
  }, [inputCurrency])

  const currencies: { [field in Field]?: Currency } = useMemo(
    () => ({
      [Field.INPUT]: inputCurrency ?? undefined
    }),
    [inputCurrency]
  )

  const balances = useCurrencyBalances(account ?? undefined, [currencies[Field.INPUT]])

  const currencyBalances: { [field in Field]?: CurrencyAmount } = {
    [Field.INPUT]: balances[0]
  }

  const independentAmount: CurrencyAmount | undefined = tryParseAmount(typedValue, currencies[independentField])

  const parsedAmounts: { [field in Field]: CurrencyAmount | undefined } = {
    [Field.INPUT]: independentAmount
  }

  const parsedAmount = tryParseAmount(typedValue, inputCurrency ?? undefined)

  const { [Field.INPUT]: inputAmount } = parsedAmounts

  const minMaxAmount: { minAmount: string; maxAmount: string } | undefined = useAsyncMemo(async () => {
    if (!inputCurrencyId || !chainId || !library || !account || !bridgeDirection) return
    try {
      return await getMinMaxPerTxn(inputCurrencyId, bridgeDirection, inputCurrency?.decimals, isHome, library, account)
    } catch (e) {
      console.error(`Failed to fetch min max amount for ${inputCurrency?.symbol} at ${inputCurrencyId}`, e)
      return { minAmount: '0', maxAmount: '1000' }
    }
  }, [inputCurrencyId, inputCurrency, bridgeDirection])

  let inputError: string | undefined
  if (!account) {
    inputError = 'Connect Wallet'
  }

  if (isHome && !bridgeDirection) {
    inputError = inputError ?? 'Select destination'
  }

  if (!currencies[Field.INPUT]) {
    inputError = inputError ?? 'Select a token'
  }

  if (!parsedAmount) {
    inputError = inputError ?? 'Enter an amount'
  }

  if (recipient && !isAddress(recipient)) {
    inputError = inputError ?? 'Enter a valid address'
  }

  if (
    minMaxAmount &&
    minMaxAmount.minAmount &&
    minMaxAmount.maxAmount &&
    Number(typedValue) < Number(minMaxAmount.minAmount)
  ) {
    inputError = inputError ?? `Below minimum limit (${minMaxAmount.minAmount})`
  }

  if (inputAmount && currencyBalances?.[Field.INPUT]?.lessThan(inputAmount)) {
    inputError = 'Insufficient ' + currencies[Field.INPUT]?.symbol + ' balance'
  }

  if (minMaxAmount && Number(typedValue) > Number(minMaxAmount.maxAmount)) {
    inputError = inputError ?? `Above maximum limit (${minMaxAmount.maxAmount})`
  }

  return {
    currencies,
    currencyBalances,
    parsedAmounts,
    inputError,
    bridgeTransactionStatus,
    confirmations,
    inputCurrencyId: currencyId
  }
}

export function useBridgeStatus(bridgeStatus: BridgeTransactionStatus): string {
  const { confirmations, bridgeDirection } = useBridgeState()
  const { isHome } = useChain()

  return useMemo(() => {
    switch (bridgeStatus) {
      case BridgeTransactionStatus.INITIAL:
        return ''
      case BridgeTransactionStatus.TOKEN_TRANSFER_PENDING:
      case BridgeTransactionStatus.TOKEN_TRANSFER_SUCCESS:
        return 'Transfering...'
      case BridgeTransactionStatus.CONFIRMATION_TRANSACTION_PENDING:
      case BridgeTransactionStatus.CONFIRMATION_TRANSACTION_SUCCESS:
        return `Waiting for ${confirmations}/${DEFAULT_CONFIRMATIONS_LIMIT} Confirmations`
      case BridgeTransactionStatus.CONFIRM_TOKEN_TRANSFER_PENDING:
        const network = isHome ? (bridgeDirection === BridgeDirection.FUSE_TO_BSC ? 'Binance' : 'Ethereum') : 'Fuse'
        return 'Moving funds to ' + network
      default:
        return ''
    }
  }, [bridgeDirection, bridgeStatus, confirmations, isHome])
}

export function useBridgeActionHandlers(): {
  onFieldInput: (typedValue: string) => void
  onSelectBridgeDirection: (direction: BridgeDirection) => void
  onSelectCurrency: (currencyId: string | undefined) => void
  onSetRecipient: (recipient: string) => void
  onSetCurrentBridgeTransaction: (bridgeTransaction: BridgeTransaction | null) => void
  onFinalizeBridgeTransaction: (homeTxHash: string, foreignTxHash: string) => void
} {
  const dispatch = useDispatch<AppDispatch>()

  const onFieldInput = useCallback(
    (typedValue: string) => {
      dispatch(typeInput({ field: Field.INPUT, typedValue }))
    },
    [dispatch]
  )

  const onSelectBridgeDirection = useCallback(
    (direction: BridgeDirection) => {
      dispatch(selectBridgeDirection({ direction }))
    },
    [dispatch]
  )

  const onSelectCurrency = useCallback(
    (currencyId: string | undefined) => {
      dispatch(selectCurrency({ field: Field.INPUT, currencyId }))
    },
    [dispatch]
  )

  const onSetRecipient = useCallback(
    (recipient: string) => {
      dispatch(setRecipient(recipient))
    },
    [dispatch]
  )

  const onSetCurrentBridgeTransaction = useCallback(
    (bridgeTransaction: BridgeTransaction | null) => {
      dispatch(setCurrentBridgeTransaction(bridgeTransaction))
    },
    [dispatch]
  )

  const onFinalizeBridgeTransaction = useCallback(
    (homeTxHash: string, foreignTxHash: string) => {
      dispatch(finalizeBridgeTransaction({ homeTxHash, foreignTxHash }))
    },
    [dispatch]
  )

  return {
    onFieldInput,
    onSelectBridgeDirection,
    onSelectCurrency,
    onSetRecipient,
    onSetCurrentBridgeTransaction,
    onFinalizeBridgeTransaction
  }
}

export function useBridgeFee(
  tokenAddress: string | undefined,
  bridgeDirection: BridgeDirection | undefined
): string | undefined {
  const { account, library } = useActiveWeb3React()
  const { isHome } = useChain()

  return useAsyncMemo(async () => {
    if (!account || !library || !tokenAddress || !bridgeDirection) return

    let method: (...args: Array<any>) => Promise<any>, args: Array<any>
    try {
      const bridgeType = getBridgeType(tokenAddress, bridgeDirection)

      switch (bridgeType) {
        case BridgeType.ETH_FUSE_ERC20_TO_ERC677:
          if (!isHome) return
          method = getMultiBridgeFee
          args = [tokenAddress, FUSE_ERC20_TO_ERC677_BRIDGE_HOME_ADDRESS, library, account, isHome]
          break
        case BridgeType.BSC_FUSE_ERC20_TO_ERC677:
          if (!isHome) return
          method = getMultiBridgeFee
          args = [tokenAddress, BINANCE_ERC20_TO_ERC677_HOME_BRIDGE_ADDRESS, library, account, isHome]
          break
        case BridgeType.BSC_FUSE_NATIVE:
          method = getNativeAMBBridgeFee
          args = [isHome, getBscFuseInverseLibrary(isHome), account]
          break
        case BridgeType.BSC_FUSE_BNB_NATIVE:
          method = getBnbNativeAMBBridgeFee
          args = [isHome, getBscFuseInverseLibrary(isHome), account]
          break
        default:
          return
      }

      const fee = await method(...args)
      return fee
    } catch (error) {
      Sentry.captureException(error)
      console.error(error)
      return
    }
  }, [isHome, account, library, tokenAddress, bridgeDirection])
}

export function useCalculatedBridgeFee(
  tokenAddress: string | undefined,
  currencyAmount: CurrencyAmount | undefined,
  bridgeDirection: BridgeDirection | undefined
): string | undefined {
  const { account, library } = useActiveWeb3React()
  const { isHome } = useChain()

  return useAsyncMemo(async () => {
    if (!tokenAddress || !currencyAmount || !account || !library || !bridgeDirection) return

    let method: (...args: Array<any>) => Promise<any>, args: Array<any>
    try {
      const bridgeType = getBridgeType(tokenAddress, bridgeDirection)

      switch (bridgeType) {
        case BridgeType.ETH_FUSE_ERC20_TO_ERC677:
          if (!isHome) return
          method = calculateMultiBridgeFee
          args = [currencyAmount, FUSE_ERC20_TO_ERC677_BRIDGE_HOME_ADDRESS, library, account]
          break
        case BridgeType.BSC_FUSE_ERC20_TO_ERC677:
          if (!isHome) return
          method = calculateMultiBridgeFee
          args = [currencyAmount, BINANCE_ERC20_TO_ERC677_HOME_BRIDGE_ADDRESS, library, account]
          break
        case BridgeType.BSC_FUSE_NATIVE:
          method = calculateNativeAMBBridgeFee
          args = [currencyAmount, isHome, getBscFuseInverseLibrary(isHome), account]
          break
        case BridgeType.BSC_FUSE_BNB_NATIVE:
          method = calculateBnbNativeAMBBridgeFee
          args = [currencyAmount, isHome, getBscFuseInverseLibrary(isHome), account]
          break
        default:
          return
      }

      const fee = await method(...args)
      return fee
    } catch (error) {
      Sentry.captureException(error)
      console.error(error)
      return
    }
  }, [isHome, tokenAddress, account, currencyAmount, library])
}

export function useDetectBridgeDirection(selectedBridgeDirection?: BridgeDirection) {
  const { chainId } = useActiveWeb3React()

  if (selectedBridgeDirection) {
    return selectedBridgeDirection
  }

  switch (chainId) {
    case ChainId.MAINNET:
    case ChainId.ROPSTEN:
      return BridgeDirection.ETH_TO_FUSE
    case BINANCE_CHAIN_ID:
      return BridgeDirection.BSC_TO_FUSE
    default:
      return undefined
  }
}

export function useDefaultsFromURLSearch() {
  const parsedQs = useParsedQueryString()

  const inputCurrencyId = parsedQs.inputCurrencyId?.toString()
  const amount = parsedQs.amount?.toString()
  const recipient = parsedQs.recipient?.toString()
  const sourceChain = Number(parsedQs.sourceChain)

  return {
    inputCurrencyId,
    amount,
    sourceChain,
    recipient
  }
}

export function useAddBridgeTransaction() {
  const dispatch = useDispatch()

  const addBridgeTransactionCallback = useCallback(
    bridgeTransaction => {
      dispatch(addBridgeTransaction(bridgeTransaction))
    },
    [dispatch]
  )

  return addBridgeTransactionCallback
}

export function useUnclaimedNativeBridgeTransaction() {
  const { bridgeTransactions } = useBridgeState()
  const { onFinalizeBridgeTransaction } = useBridgeActionHandlers()
  const [unclaimedTransaction, setUnclaimedTransaction] = useState<any>(null)

  useEffect(() => {
    async function getTransaction() {
      const transaction = await getUnclaimedNativeTransaction(bridgeTransactions)
      if (transaction) {
        const status = await getNativeBridgeTransactionStatus(transaction)

        if (status && transaction.homeTxHash) {
          onFinalizeBridgeTransaction(transaction.homeTxHash, status.id)
        } else {
          setUnclaimedTransaction(transaction)
        }
      }
    }

    getTransaction()
  }, [bridgeTransactions, onFinalizeBridgeTransaction])

  return unclaimedTransaction
}

export function useUnclaimedAmbBridgeTransaction() {
  const { bridgeTransactions } = useBridgeState()
  const { onFinalizeBridgeTransaction } = useBridgeActionHandlers()
  const [unclaimedTransaction, setUnclaimedTransaction] = useState<any>(null)

  useEffect(() => {
    async function getTransaction() {
      const transaction = await getUnclaimedAmbTransaction(bridgeTransactions)
      if (transaction) {
        const status = await getAmbBridgeTransactionStatus(transaction)

        if (status && transaction.homeTxHash) {
          onFinalizeBridgeTransaction(transaction.homeTxHash, status.id)
        } else {
          setUnclaimedTransaction(transaction)
        }
      }
    }

    getTransaction()
  }, [bridgeTransactions, onFinalizeBridgeTransaction])

  return unclaimedTransaction
}
