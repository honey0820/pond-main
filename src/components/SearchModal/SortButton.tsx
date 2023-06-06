import React from 'react'
import { Text } from 'rebass'
import styled from 'styled-components'
import { RowFixed } from '../Row'

export const FilterWrapper = styled(RowFixed)`
  padding: 8px;
  /* background: linear-gradient(90deg, hsla(247,96%,61%,1) , hsla(188,100%,64%,1)); */
  background:#3ad889;

  color: ${({ theme }) => theme.text1};
  border-radius: 8px;
  user-select: none;
  & > * {
    user-select: none;
  }
  :hover {
    cursor: pointer;
    /* background: linear-gradient(93.58deg,#f3fc1f -105.35%,#3ad889 103.54%); */
  }
`

export default function SortButton({
  toggleSortOrder,
  ascending
}: {
  toggleSortOrder: () => void
  ascending: boolean
}) {
  return (
    <FilterWrapper onClick={toggleSortOrder}>
      <Text fontSize={14} fontWeight={500}>
        {ascending ? '↑' : '↓'}
      </Text>
    </FilterWrapper>
  )
}
