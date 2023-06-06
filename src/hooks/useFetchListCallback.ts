import { nanoid } from '@reduxjs/toolkit'
import { ChainId } from '@fuseio/fuse-swap-sdk'
import { TokenList } from '@fuseio/token-lists'
import { useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { getNetworkLibrary, FUSE_CHAIN_ID } from '../connectors'
import { AppDispatch } from '../state'
import { fetchTokenList } from '../state/lists/actions'
import getTokenList from '../utils/getTokenList'
import resolveENSContentHash from '../utils/resolveENSContentHash'
import { useActiveWeb3React } from './index'

export function useFetchListCallback(): (listUrl: string, listType: CurrencyListType) => Promise<TokenList> {
  const { chainId, library } = useActiveWeb3React()
  const dispatch = useDispatch<AppDispatch>()

  const ensResolver = useCallback(
    (ensName: string) => {
      if (!library || chainId !== ChainId.MAINNET) {
        if (FUSE_CHAIN_ID === ChainId.MAINNET) {
          const networkLibrary = getNetworkLibrary()
          if (networkLibrary) {
            return resolveENSContentHash(ensName, networkLibrary)
          }
        }
        throw new Error('Could not construct mainnet ENS resolver')
      }
      return resolveENSContentHash(ensName, library)
    },
    [chainId, library]
  )

  return useCallback(
    async (listUrl: string, listType: CurrencyListType) => {
      const requestId = nanoid()
      dispatch(fetchTokenList.pending({ requestId, listType, url: listUrl }))
      return getTokenList(listUrl, ensResolver)
        .then(tokenList => {
          dispatch(fetchTokenList.fulfilled({ url: listUrl, tokenList, requestId, listType }))
          return tokenList
        })
        .catch(error => {
          console.debug(`Failed to get list at url ${listUrl}`, error)
          dispatch(fetchTokenList.rejected({ url: listUrl, requestId, listType, errorMessage: error.message }))
          throw error
        })
    },
    [dispatch, ensResolver]
  )
}
